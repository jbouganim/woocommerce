/* eslint-disable @typescript-eslint/no-namespace */
/**
 * External dependencies
 */
import { decodeEntities } from '@wordpress/html-entities';
import { PLACEHOLDER_IMG_SRC } from '@woocommerce/settings';
// eslint-disable-next-line @woocommerce/dependency-group
import ProductImage from '../product-image';

//86inc 86co edit
declare global {
	namespace JSX {
		interface IntrinsicElements {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'swiper-container': React.DetailedHTMLProps<
				React.HTMLAttributes< HTMLElement >,
				HTMLElement
			>;
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'swiper-slide': React.DetailedHTMLProps<
				React.HTMLAttributes< HTMLElement >,
				HTMLElement
			>;
		}
	}
}

//86inc 86co edit
declare module 'react' {
	interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
		// extends React's HTMLAttributes
		pagination?: string;
	  }
}

interface ProductImagesProps {
	images: [];
}
/**
 * Formats and returns an image element.
 *
 * @param {Object} props       Incoming props for the component.
 * @param {Object} props.image Image properties.
 */

const ProductImages = ( { images = [] }: ProductImagesProps ): JSX.Element => {
	if ( images?.length < 2 ) {
		const image = images.pop() || { alt: '', thumbnail: '' };
		return <ProductImage image={ image } fallbackAlt="" />;
	}

	return (
		<swiper-container
			class="cartImages"
			pagination="true"
			pagination-clickable="true"
		>
			{ images.map( ( image, index ) => (
				// eslint-disable-next-line react/jsx-key
				<swiper-slide key={ index }>
					<ProductImage image={ image } fallbackAlt="" />
				</swiper-slide>
			) ) }
		</swiper-container>
	);
};

export default ProductImages;
