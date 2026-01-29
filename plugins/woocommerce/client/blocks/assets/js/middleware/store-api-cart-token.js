/**
 * External dependencies
 */
import apiFetch from '@wordpress/api-fetch';

// Stores the current token for the middleware.
let currentCartToken = '';

/**
 * Returns whether or not this is a wc/store API request.
 *
 * @param {any} options Fetch options.
 *
 * @return {boolean} Returns true if this is a store request.
 */
export const isStoreApiRequest = ( options ) => {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore -- options shape varies by apiFetch usage.
	const url = options.url || options.path;
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore -- options shape varies by apiFetch usage.
	if ( ! url || ! options.method || options.method === 'GET' ) {
		return false;
	}
	// if (
	// 	! url.includes( '/wc/store/v1/cart' ) &&
	// 	! url.includes( '/wc/store/v1/checkout' ) &&
	// 	! url.includes( '/wc/store/v1/batch' )
	// ) {
	// 	return false;
	// }
	return /wc\/store\/v1\//.exec( url ) !== null;
};

/**
 * Updates the stored CartToken within localStorage so it is persisted between page loads.
 *
 * @param {string} cartToken Incoming token string
 */
const updateCartToken = ( cartToken ) => {
	// If the "new" CartToken matches the current CartToken, we don't need to update.
	if ( cartToken === currentCartToken ) {
		return;
	}
	currentCartToken = cartToken;
};

/**
 * Set the current CartToken from a header object.
 *
 * @param {any} headers Headers object.
 */
const setCartToken = ( headers ) => {
	const cartToken =
		typeof headers?.get === 'function'
			? headers.get( 'Cart-Token' )
			: headers[ 'Cart-Token' ];

	if ( cartToken ) {
		updateCartToken( cartToken );
	}
};

/**
 * @param {any} request Request options.
 */
const appendCartTokenHeader = ( request ) => {
	if ( ! currentCartToken ) {
		return request;
	}
	const headers = request.headers || {};
	request.headers = {
		...headers,
		'Cart-Token': currentCartToken,
	};
	return request;
};

/**
 * Cart token middleware which appends the current cart token to store API requests.
 *
 * @param {any}      options Fetch options.
 * @param {Function} next    The next middleware or fetchHandler to call.
 * @return {*} The evaluated result of the remaining middleware chain.
 */
const storeCartTokenMiddleware = ( options, next ) => {
	if ( isStoreApiRequest( options ) ) {
		options = appendCartTokenHeader( options );

		// Add cart token to sub-requests
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore -- data can exist in apiFetch options.
		if ( Array.isArray( options?.data?.requests ) ) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore -- data can exist in apiFetch options.
			options.data.requests = options.data.requests.map(
				appendCartTokenHeader
			);
		}
	}
	return next( options, next );
};

apiFetch.use( storeCartTokenMiddleware );

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- this does exist because it's monkey patched in this file.
apiFetch.setCartToken = setCartToken;
