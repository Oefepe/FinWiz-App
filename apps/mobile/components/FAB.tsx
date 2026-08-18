import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FABProps {
  onPress: () => void;
}

export function FAB({ onPress }: FABProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="absolute bottom-24 right-5 w-14 h-14 bg-purple-600 rounded-full items-center justify-center shadow-lg"
    >
      <Ionicons name="add" size={28} color="white" />
    </TouchableOpacity>
  );
}
