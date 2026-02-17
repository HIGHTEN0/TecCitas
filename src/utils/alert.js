import { Alert, Platform } from 'react-native';

/**
 * Muestra una alerta simple (solo botón OK).
 * En web usa window.alert, en native usa Alert.alert.
 */
export function showAlert(title, message) {
    if (Platform.OS === 'web') {
        window.alert(message ? `${title}\n\n${message}` : title);
    } else {
        Alert.alert(title, message);
    }
}

/**
 * Muestra un diálogo de confirmación (Cancelar / Confirmar).
 * En web usa window.confirm, en native usa Alert.alert con botones.
 */
export function showConfirm(title, message, { confirmText = 'OK', cancelText = 'Cancelar', onConfirm, onCancel, destructive = false } = {}) {
    if (Platform.OS === 'web') {
        const result = window.confirm(message ? `${title}\n\n${message}` : title);
        if (result) {
            onConfirm && onConfirm();
        } else {
            onCancel && onCancel();
        }
    } else {
        Alert.alert(title, message, [
            { text: cancelText, style: 'cancel', onPress: onCancel },
            { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
        ]);
    }
}
