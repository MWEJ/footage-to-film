# Colour

## Phone HDR to standard range

iPhone video is HLG HDR: transfer `arib-std-b67`, BT.2020 primaries, 10-bit. The inventory marks these clips `HDR (arib-std-b67)`. `convert.mjs` turns them into standard-range BT.709 with a 3D table, `hlg2sdr_f.cube`:

```
scale=W:H:flags=lanczos:in_color_matrix=bt2020:in_range=tv:out_range=pc,format=gbrp10le,
lut3d=file=hlg2sdr_f.cube:interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p
```

The table was tuned on the first film to match the iPhone's own photos of the same scenes. `SKILL/assets/hlg.py` holds the functions that build such a table (`hlg_to_sdr`, `hlg_to_sdr2`, `write_cube`); the settings that produced this one were not recorded, so treat the table itself as the reference. If a film's clips look wrong after conversion, compare a converted frame with a phone photo of the same scene before changing anything.

ffmpeg-full can also do `zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p`. It has not been tuned; a first attempt came out dark and flat.

PQ HDR (`smpte2084`, some Android phones) is not covered. `convert.mjs` stops and names the clip.

## Tags

Converted files must be tagged BT.709. The render engine decodes video in a browser, and browsers honour colour tags: a standard-range file still tagged HLG renders far too saturated and contrasty (measured: 18 to 19 dB PSNR against the right picture). `convert.mjs` writes the tags three ways (frame properties, the H.264 bitstream, the container) and refuses a file that does not come out as `bt709, bt709, bt709`. To re-tag an existing standard-range file without re-encoding:

```
ffmpeg -i in.mp4 -map 0:v:0 -map '0:a:0?' -c copy -bsf:v h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1 -color_primaries bt709 -color_trc bt709 -colorspace bt709 out.mp4
```

## Photos

Phone photos are Display P3. `photos.py` converts them to sRGB, turns them upright and limits the long side to 2880 px. Without the conversion they look dull in the film.

## Judging colour

Judge colour from rendered stills (`npm run still`), not from Studio: Studio plays video through a different path than the render.

## 360° footage (untested notes)

For Insta360 clips, ask for a stitched, stabilised 360 export from Insta360 Studio, then cut flat shots with `v360=input=e:output=flat:yaw=Y:pitch=P:h_fov=100:v_fov=65:w=1920:h=1080`. Raw dual-fisheye files stitch with `v360=input=dfisheye:output=e:ih_fov=204:iv_fov=204`, with rougher seams and no stabilisation. Both were only tried on synthetic frames.
