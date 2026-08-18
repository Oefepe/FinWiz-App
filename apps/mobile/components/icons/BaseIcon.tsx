import Svg, { Path } from 'react-native-svg';
import { tokens } from '../../theme/tokens';

export interface IconProps {
  size?: number;
  color?: string;
}

// Every icon in this set is a single 24x24 path exported from the PadLock
// Figma file's Assets page. This factory keeps each icon file to one line —
// the exported fill color on individual SVGs (e.g. Pencil/Trash came out
// #9747FF, Cross/Plus came out black) was incidental to whatever was
// selected on the Figma canvas at export time, not a deliberate per-icon
// color choice, so every icon defaults to `iconDark` and is recolored via
// the `color` prop by its consumer (active/inactive nav state, alert color
// for delete, etc.) rather than carrying a baked-in color.
export function createIcon(pathData: string) {
  return function Icon({ size = 24, color = tokens.iconDark }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={pathData} fill={color} />
      </Svg>
    );
  };
}
