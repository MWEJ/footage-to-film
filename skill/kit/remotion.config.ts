// Settings for the Remotion command line. Scripts that use Remotion's Node API (scripts/lib/stills.ts) do not read this file.
import { Config } from '@remotion/cli/config';

Config.setRspack(true);
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
