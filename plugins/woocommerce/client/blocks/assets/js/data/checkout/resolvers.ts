/**
 * External dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import type { CheckoutResponseSuccess } from '@woocommerce/types';

/**
 * Internal dependencies
 */
import { isEditor } from '../utils/is-editor';
import type { CheckoutDispatchFromMap } from './index';

// Preview data for the editor
const previewCheckoutData: CheckoutResponseSuccess = {
	order_id: 1,
	customer_id: 0,
	billing_address: {} as CheckoutResponseSuccess[ 'billing_address' ],
	shipping_address: {} as CheckoutResponseSuccess[ 'shipping_address' ],
	customer_note: '',
	extensions: {},
	order_key: '',
	payment_method: '',
	payment_result: {
		payment_details: {},
		payment_status: 'success',
		redirect_url: '',
	},
	status: 'draft',
};

/**
 * Resolver for retrieving checkout data.
 */
export const getCheckoutData =
	() =>
	async ( { dispatch }: { dispatch: CheckoutDispatchFromMap } ) => {
		if ( isEditor() ) {
			dispatch.receiveCheckoutData( previewCheckoutData );
			return;
		}

		// Only try to fetch if we have a cart session cookie.
		// The cookie indicates the server might have a draft order.
		// Without it, the GET request would fail with 400 error,
		// so we skip it and let checkout work with default state.
		// The draft order will be created via updateDraftOrder when
		// the user interacts with the checkout form.
		if ( ! document.cookie.includes( 'woocommerce_cart_hash' ) ) {
			return;
		}

		try {
			const response = await apiFetch< CheckoutResponseSuccess >( {
				path: '/wc/store/v1/checkout?__experimental_calc_totals=true',
				method: 'GET',
				cache: 'no-store',
			} );

			if ( response ) {
				dispatch.receiveCheckoutData( response );
			}
		} catch ( error ) {
			// If fetch fails (e.g., draft order doesn't exist yet), that's okay.
			// The checkout will work with default state and create an order
			// when the user interacts with the form (via updateDraftOrder thunk).
			// eslint-disable-next-line no-console
			console.log( 'Checkout data fetch failed:', error );
		}
	};
