import CartScreen from '../cart';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';

export default function CartTabScreen() {
	useAndroidTabBackToHome();

	return <CartScreen />;
}
