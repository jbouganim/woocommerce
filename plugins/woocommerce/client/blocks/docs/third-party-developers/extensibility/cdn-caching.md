# CDN caching awareness

When the **CDN caching** experimental feature is enabled, WooCommerce stops baking per-user data (cart contents, counts, totals, addresses, etc.) into server-rendered HTML so pages can be cached at the edge. Personalized data is instead rehydrated on the client via the Store API after page load.

Third-party blocks and extensions that render per-user data server-side need to opt into this behavior to avoid leaking personalized state into cached responses.

## Table of contents

- [The `should_hydrate()` helper](#the-should_hydrate-helper)
- [The `woocommerce_blocks_should_hydrate` filter](#the-woocommerce_blocks_should_hydrate-filter)
- [Gating an Interactivity API block](#gating-an-interactivity-api-block)
- [Optional: scrubbing the IAPI JSON payload](#optional-scrubbing-the-iapi-json-payload)

## The `should_hydrate()` helper

`Automattic\WooCommerce\Blocks\Utils\BlocksSharedState::should_hydrate()` is the single source of truth for whether server-rendered output should include per-user data. Call it from any render callback that would otherwise write cart/customer/session data into HTML or Interactivity API state.

```php
use Automattic\WooCommerce\Blocks\Utils\BlocksSharedState;

$should_hydrate = BlocksSharedState::should_hydrate( 'acme/shipping-progress' );
```

It returns `true` when personalized data is safe to render and `false` when the response must remain cacheable. When it returns `false`, emit neutral defaults (zeros, empty strings, empty arrays) and let the client populate real values.

The single argument is the block or IAPI store namespace making the decision (e.g. `woocommerce/mini-cart`, `acme/shipping-progress`). It is passed through to the filter below so subscribers can branch on it.

## The `woocommerce_blocks_should_hydrate` filter

The helper applies `woocommerce_blocks_should_hydrate`, which lets site owners or extensions override the decision per call site — for example, keeping personalization on a specific block or route while letting the rest of the site remain cacheable.

```php
add_filter(
    'woocommerce_blocks_should_hydrate',
    function ( bool $should_hydrate, string $namespace ): bool {
        if ( is_account_page() ) {
            return true;
        }
        return $should_hydrate;
    },
    10,
    2
);
```

## Gating an Interactivity API block

If your block writes cart-like data into IAPI state during server rendering, wrap those writes in a `should_hydrate()` check and emit a neutral shape when hydration is skipped.

```php
use Automattic\WooCommerce\Blocks\Utils\BlocksSharedState;

function acme_render_shipping_progress( $attributes, $content, $block ) {
    $should_hydrate = BlocksSharedState::should_hydrate( 'acme/shipping-progress' );

    $item_count          = $should_hydrate ? WC()->cart->get_cart_contents_count() : 0;
    $remaining_for_free  = $should_hydrate ? acme_get_free_shipping_remainder() : '';

    wp_interactivity_state(
        'acme/shipping-progress',
        array(
            'itemCount'          => $item_count,
            'remainingForFree'   => $remaining_for_free,
        )
    );

    return $content;
}
```

When CDN caching is on, the block renders with neutral state and the frontend IAPI store rehydrates real values from the Store API response.

## Optional: scrubbing the IAPI JSON payload

Gating at render time is the primary fix. If for some reason a block cannot be updated (for example, a third-party dependency writes personalized values into IAPI state and you want a defense-in-depth backstop), you can scrub the serialized IAPI JSON blob before it is written to the page.

The `script_module_data_@wordpress/interactivity` core filter is called with the full `{ state, config }` payload that will be serialized into `<script id="wp-script-module-data-@wordpress/interactivity">`. It only affects the JSON payload — it does **not** remove values that have already been written into directive-evaluated HTML (`data-wp-text`, `data-wp-bind--*`, etc.), so it is not a substitute for inline gating.

Sample — zero out well-known personalized paths when CDN caching is active:

```php
use Automattic\WooCommerce\Blocks\Utils\BlocksSharedState;

add_filter(
    'script_module_data_@wordpress/interactivity',
    function ( array $data ): array {
        $should_scrub = ! BlocksSharedState::should_hydrate( 'acme/shipping-progress' );
        if ( ! $should_scrub || empty( $data['state'] ) ) {
            return $data;
        }

        $paths = array(
            'acme/shipping-progress' => array( 'itemCount', 'remainingForFree' ),
        );

        foreach ( $paths as $namespace => $keys ) {
            if ( ! isset( $data['state'][ $namespace ] ) ) {
                continue;
            }
            foreach ( $keys as $key ) {
                if ( is_array( $data['state'][ $namespace ] )
                    && array_key_exists( $key, $data['state'][ $namespace ] ) ) {
                    unset( $data['state'][ $namespace ][ $key ] );
                }
            }
        }

        return $data;
    }
);
```

For nested paths, walk the array manually or reach for a helper such as `_wp_array_get` / `_wp_array_set`. Keep the allowlist tight — only scrub keys you know are personalized, since overzealous scrubbing can break unrelated UI.
