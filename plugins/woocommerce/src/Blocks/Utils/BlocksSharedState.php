<?php

declare(strict_types=1);

namespace Automattic\WooCommerce\Blocks\Utils;

use InvalidArgumentException;
use Automattic\WooCommerce\Blocks\Package;
use Automattic\WooCommerce\Blocks\Domain\Services\Hydration;
use Automattic\WooCommerce\StoreApi\StoreApi;
use Automattic\WooCommerce\StoreApi\SchemaController;
use Automattic\WooCommerce\StoreApi\Utilities\CartController;
use Automattic\WooCommerce\StoreApi\Schemas\V1\CartSchema;

/**
 * Manages the registration of interactivity config and state that is commonly shared by WooCommerce blocks.
 * Initialization only happens on the first call to initialize_shared_config.
 * Intended to be used as a singleton.
 */
trait BlocksSharedState {

	/**
	 * The consent statement for using private APIs of this class.
	 *
	 * @var string
	 */
	private static $consent_statement = 'I acknowledge that using private APIs means my theme or plugin will inevitably break in the next version of WooCommerce';

	/**
	 * The namespace for the config.
	 *
	 * @var string
	 */
	private static $settings_namespace = 'woocommerce';

	/**
	 * Whether the core config has been registered.
	 *
	 * @var boolean
	 */
	private static $core_config_registered = false;

	/**
	 * Cart state.
	 *
	 * @var mixed
	 */
	private static $blocks_shared_cart_state;

	/**
	 * Prevent caching on certain pages
	 */
	private static function prevent_cache() {
		\WC_Cache_Helper::set_nocache_constants();
		nocache_headers();
	}


	/**
	 * Check that the consent statement was passed.
	 *
	 * @param string $consent_statement - The consent statement string.
	 * @return true
	 * @throws \InvalidArgumentException - If the statement does not match the class consent statement string.
	 */
	private static function check_consent( $consent_statement ) {
		if ( $consent_statement !== self::$consent_statement ) {
			throw new InvalidArgumentException( 'This method cannot be called without consenting the API may change.' );
		}

		return true;
	}

	/**
	 * Initialize the shared core config.
	 *
	 * @param string $consent_statement - The consent statement string.
	 */
	public function initialize_shared_config( $consent_statement ) {
		self::check_consent( $consent_statement );

		if ( self::$core_config_registered ) {
			return;
		}

		self::$core_config_registered = true;

		wp_interactivity_config( self::$settings_namespace, self::get_currency_data() );
		wp_interactivity_config( self::$settings_namespace, self::get_locale_data() );
		wp_interactivity_config( self::$settings_namespace, self::get_core_data() );
	}

	/**
	 * Initialize interactivity state for cart that is needed by multiple blocks.
	 *
	 * @param string $consent_statement - The consent statement string.
	 * @return void
	 */
	public function register_cart_interactivity( $consent_statement ) {
		self::check_consent( $consent_statement );

		if ( null === self::$blocks_shared_cart_state ) {
			$cart_exists       = isset( WC()->cart );
			$cart_has_contents = $cart_exists && ! WC()->cart->is_empty();

			$cart_response                  = Package::container()->get( Hydration::class )->get_rest_api_response_data( '/wc/store/v1/cart' );
			self::$blocks_shared_cart_state = $cart_response['body'] ?? array();

			/**
			 * Filters whether the cart should be hydrated into interactivity state.
			 *
			 * @since 9.6.0
			 *
			 * @param bool $should_hydrate_cart Whether to hydrate cart data.
			 */
			$should_hydrate_cart = apply_filters( 'woocommerce_blocks_should_hydrate_cart', true );
			if ( $cart_exists && ! $should_hydrate_cart ) {
				self::$blocks_shared_cart_state['items'] = array();
				self::$blocks_shared_cart_state['coupons'] = array();
				self::$blocks_shared_cart_state['items_count'] = 0;
				self::$blocks_shared_cart_state['items_weight'] = 0;
				self::$blocks_shared_cart_state['needs_payment'] = false;
				self::$blocks_shared_cart_state['needs_shipping'] = false;
				self::$blocks_shared_cart_state['has_calculated_shipping'] = false;
				self::$blocks_shared_cart_state['fees'] = array();
				self::$blocks_shared_cart_state['totals'] = array();
				self::$blocks_shared_cart_state['shipping_address'] = array();
				self::$blocks_shared_cart_state['billing_address'] = array();
			}

			/**
			 * Filters whether cart contents should prevent caching.
			 *
			 * @since 9.6.0
			 *
			 * @param bool $should_prevent_cache Whether to send no-cache headers.
			 * @param bool $cart_has_contents    Whether the cart has contents.
			 */
			$should_prevent_cache = apply_filters(
				'woocommerce_blocks_should_prevent_cart_cache',
				$cart_has_contents,
				$cart_has_contents
			);
			if ( $cart_has_contents && $should_prevent_cache ) {
				self::prevent_cache();
			}

			wp_interactivity_state(
				'woocommerce',
				array(
					'cart'     => self::$blocks_shared_cart_state,
					'nonce'    => wp_create_nonce( 'wc_store_api' ),
					'noticeId' => '',
					'restUrl'  => get_rest_url(),
				)
			);
		}
	}

	/**
	 * Get core data to include in settings.
	 *
	 * @return array
	 */
	private static function get_core_data() {
		return [
			'isBlockTheme' => wp_is_block_theme(),
		];
	}

	/**
	 * Get currency data to include in settings.
	 *
	 * @return array
	 */
	private static function get_currency_data() {
		$currency = get_woocommerce_currency();

		return [
			'currency' => [
				'code'              => $currency,
				'precision'         => wc_get_price_decimals(),
				'symbol'            => html_entity_decode( get_woocommerce_currency_symbol( $currency ) ),
				'symbolPosition'    => get_option( 'woocommerce_currency_pos' ),
				'decimalSeparator'  => wc_get_price_decimal_separator(),
				'thousandSeparator' => wc_get_price_thousand_separator(),
				'priceFormat'       => html_entity_decode( get_woocommerce_price_format() ),
			],
		];
	}

	/**
	 * Get locale data to include in settings.
	 *
	 * @return array
	 */
	private static function get_locale_data() {
		global $wp_locale;

		return [
			'locale' => [
				'siteLocale'    => get_locale(),
				'userLocale'    => get_user_locale(),
				'weekdaysShort' => array_values( $wp_locale->weekday_abbrev ),
			],
		];
	}

	/**
	 * Add placeholder image.
	 *
	 * @param string $consent_statement - The consent statement string.
	 */
	public function placeholder_image( $consent_statement ) {
		self::check_consent( $consent_statement );

		wp_interactivity_config(
			self::$settings_namespace,
			array( 'placeholderImgSrc' => wc_placeholder_img_src() )
		);
	}
}
