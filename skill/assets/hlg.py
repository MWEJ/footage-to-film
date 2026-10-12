import numpy as np
A, B, C = 0.17883277, 0.28466892, 0.55991073
M2020_709 = np.array([[1.660491, -0.587641, -0.072850], [-0.124550, 1.132900, -0.008349], [-0.018151, -0.100579, 1.118730]])
LUM2020 = np.array([0.2627, 0.6780, 0.0593])
LUM709 = np.array([0.2126, 0.7152, 0.0722])

def hlg_inv_oetf(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.5, x * x / 3.0, (np.exp((x - C) / A) + B) / 12.0)

def srgb_oetf(l):
    l = np.clip(l, 0, 1)
    return np.where(l <= 0.0031308, 12.92 * l, 1.055 * np.power(l, 1 / 2.4) - 0.055)

def shoulder(x, k=0.5, m=1.0):
    # identity below knee k, smooth tanh rolloff to m above
    return np.where(x < k, x, k + (m - k) * np.tanh((x - k) / (m - k)))

def hlg_to_sdr(rgb, gain=1.0, knee=0.5, sat=1.0, contrast=0.0, pivot=0.18, lw=1000.0, mixpc=0.5, black=0.0, hsat=0.6):
    """rgb: float array (...,3) HLG-encoded BT.2020 full-range 0..1 -> sRGB-encoded BT.709 0..1"""
    E = hlg_inv_oetf(rgb)                                   # scene linear 0..1
    Ys = (E * LUM2020).sum(-1, keepdims=True)
    gamma = 1.2
    Fd = lw * np.power(np.maximum(Ys, 1e-6), gamma - 1.0) * E    # display light, nits
    x = Fd / 203.0 * gain                                   # 1.0 = HDR reference white
    Y = (x * LUM2020).sum(-1, keepdims=True)
    # luminance-preserving tone map
    Yt = shoulder(Y, knee)
    lum = x * (Yt / np.maximum(Y, 1e-6))
    pc = shoulder(x, knee)                                  # per-channel tone map
    y = mixpc * pc + (1 - mixpc) * lum
    # gamut 2020 -> 709
    o = y @ M2020_709.T
    Yo = (o * LUM709).sum(-1, keepdims=True)
    # saturation
    o = Yo + (o - Yo) * sat
    # highlight desaturation: as luminance nears 1, blend toward white-ish luminance
    hd = np.clip((Yo - 0.75) / 0.25, 0, 1) ** 2 * (1 - hsat)
    o = o * (1 - hd) + Yo * hd
    # gamut clip toward gray for negatives
    mn = o.min(-1, keepdims=True)
    t = np.where(mn < 0, Yo / np.maximum(Yo - mn, 1e-6), 1.0)
    o = Yo + (o - Yo) * np.clip(t, 0, 1)
    # soft clip >1
    mx = o.max(-1, keepdims=True)
    t2 = np.where(mx > 1, (1 - Yo) / np.maximum(mx - Yo, 1e-6), 1.0)
    o = Yo + (o - Yo) * np.clip(t2, 0, 1)
    o = np.clip(o, 0, 1)
    v = srgb_oetf(o)
    if contrast:
        # S-curve around mid gray in display space
        p = srgb_oetf(np.array(pivot))
        v = np.clip(v, 0, 1)
        lo = p * np.power(v / p, 1 + contrast)
        hi = 1 - (1 - p) * np.power((1 - v) / (1 - p), 1 + contrast)
        v = np.where(v < p, lo, hi)
    if black:
        v = (v - black) / (1 - black)
    return np.clip(v, 0, 1)

def write_cube(path, n=65, **kw):
    g = np.linspace(0, 1, n)
    # .cube order: R changes fastest
    b, gg, r = np.meshgrid(g, g, g, indexing='ij')
    rgb = np.stack([r, gg, b], -1).reshape(-1, 3)
    out = hlg_to_sdr(rgb, **kw)
    with open(path, 'w') as f:
        f.write('TITLE "HLG2020 to sRGB709"\nLUT_3D_SIZE %d\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n' % n)
        np.savetxt(f, out, fmt='%.6f')

def hlg_oetf(E):
    E = np.maximum(E, 0)
    return np.where(E <= 1 / 12.0, np.sqrt(3 * E), A * np.log(np.maximum(12 * E - B, 1e-9)) + C)

def hlg_to_sdr2(rgb, gain=1.0, gd=2.4, sat=1.0, contrast=0.0, pivot=0.45, knee=0.85, mixpc=0.5, lift=0.0, hsat=1.0):
    """Backward-compatible style: scene-linear gain -> HLG OETF as display signal -> gamma gd -> sRGB."""
    E = hlg_inv_oetf(rgb) * gain
    o = E @ M2020_709.T
    Y = (o * LUM709).sum(-1, keepdims=True)
    mn = o.min(-1, keepdims=True)
    t = np.where(mn < 0, Y / np.maximum(Y - mn, 1e-9), 1.0)
    o = Y + (o - Y) * np.clip(t, 0, 1)
    o = np.maximum(o, 0)
    # tone: hybrid of per-channel and luminance-ratio
    def tone(e):
        s = hlg_oetf(e)
        s = shoulder(s, knee, 1.0)
        return np.power(np.clip(s, 0, 1), gd)
    Yt = tone(Y)
    lum = o * (Yt / np.maximum(Y, 1e-9))
    pc = tone(o)
    L = mixpc * pc + (1 - mixpc) * lum
    Yl = (L * LUM709).sum(-1, keepdims=True)
    L = Yl + (L - Yl) * sat
    # desaturate near-white highlights a bit to avoid neon clipping
    hd = np.clip((Yl - 0.7) / 0.3, 0, 1) ** 2 * (1 - hsat)
    L = L * (1 - hd) + Yl * hd
    mx = L.max(-1, keepdims=True)
    t2 = np.where(mx > 1, (1 - Yl) / np.maximum(mx - Yl, 1e-9), 1.0)
    L = Yl + (L - Yl) * np.clip(t2, 0, 1)
    v = srgb_oetf(np.clip(L, 0, 1))
    if contrast:
        p = pivot
        lo = p * np.power(np.clip(v, 0, 1) / p, 1 + contrast)
        hi = 1 - (1 - p) * np.power((1 - np.clip(v, 0, 1)) / (1 - p), 1 + contrast)
        v = np.where(v < p, lo, hi)
    if lift:
        v = v + lift * (1 - v) * v * 4 * 0.25   # gentle mid lift
    return np.clip(v, 0, 1)
