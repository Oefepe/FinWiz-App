import { Modal, Text, View } from 'react-native';
import { Button } from './Button';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';
import { radii } from '../theme/radii';

export interface ConfirmDialogProps {
  visible: boolean;
  title?: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

// Matches the Figma "Are you sure?" pattern used for delete-transaction and
// destructive profile edits: dimmed backdrop, centered white card, red title,
// optional body copy, single primary pill button.
export function ConfirmDialog({
  visible,
  title = 'Are you sure?',
  message,
  confirmLabel,
  onConfirm,
  onDismiss,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 360,
            backgroundColor: tokens.surface,
            borderRadius: radii.card,
            padding: 24,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: tokens.alert,
              textAlign: 'center',
              marginBottom: message ? 12 : 20,
              fontFamily: typography.headingBold.fontFamily,
              fontSize: typography.headingBold.fontSize,
              lineHeight: typography.headingBold.lineHeight,
            }}
          >
            {title}
          </Text>
          {message !== undefined && (
            <Text
              style={{
                color: tokens.textPrimary,
                textAlign: 'center',
                marginBottom: 20,
                fontFamily: typography.body.fontFamily,
                fontSize: typography.body.fontSize,
                lineHeight: typography.body.lineHeight,
              }}
            >
              {message}
            </Text>
          )}
          <View style={{ width: '100%' }}>
            <Button label={confirmLabel} onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default ConfirmDialog;
