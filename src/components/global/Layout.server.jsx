import {Suspense} from 'react';
import {useLocalization, useShopQuery, CacheLong, gql, useSession} from '@shopify/hydrogen';

import {Header} from '~/components';
import {Footer} from '~/components/index.server';
import {parseMenu} from '~/lib/utils';

const HEADER_MENU_HANDLE = 'main-menu';
const FOOTER_MENU_HANDLE = 'footer';

const SHOP_NAME_FALLBACK = 'Hydrogen';

/**
 * A server component that defines a structure and organization of a page that can be used in different parts of the Hydrogen app
 */
export function Layout({children}) {
  return (
    <>
    <div className='bg-[#A60D1E] text-center py-3'><h3 className='text-[#FFFFFF] text-bold'>FREE LIFETIME BREAKFAST WHEN YOU SUBSCRIBE!</h3></div>
      <div className="flex flex-col min-h-screen">
        <div className="">
          <a href="#mainContent" className="sr-only">
            Skip to content
          </a>
        </div>
        <Suspense fallback={<Header title={SHOP_NAME_FALLBACK} />}>
          <HeaderWithMenuAndToken />
        </Suspense>
        <main role="main" id="mainContent" className="flex-grow overflow-x-hidden">
          {children}
        </main>
      </div>
      <Suspense fallback={<Footer />}>
        <FooterWithMenu />
      </Suspense>
    </>
  );
}

function HeaderWithMenuAndToken() {
  const {shopName, headerMenu} = useLayoutQuery();
  const {customerAccessToken} = useSession();
  return <Header token={customerAccessToken} title={shopName} menu={headerMenu} />;
}

function FooterWithMenu() {
  const {footerMenu} = useLayoutQuery();
  return <Footer menu={footerMenu} />;
}

function useLayoutQuery() {
  const {
    language: {isoCode: languageCode},
  } = useLocalization();

  const {data} = useShopQuery({
    query: SHOP_QUERY,
    variables: {
      language: languageCode,
      headerMenuHandle: HEADER_MENU_HANDLE,
      footerMenuHandle: FOOTER_MENU_HANDLE,
    },
    cache: CacheLong(),
    preload: '*',
  });

  const shopName = data ? data.shop.name : SHOP_NAME_FALLBACK;

  /*
        Modify specific links/routes (optional)
        @see: https://shopify.dev/api/storefront/unstable/enums/MenuItemType
        e.g here we map:
          - /blogs/news -> /news
          - /blog/news/blog-post -> /news/blog-post
          - /collections/all -> /products
      */
  const customPrefixes = {BLOG: '', CATALOG: 'products'};

  const headerMenu = data?.headerMenu
    ? parseMenu(data.headerMenu, customPrefixes)
    : undefined;

  const footerMenu = data?.footerMenu
    ? parseMenu(data.footerMenu, customPrefixes)
    : undefined;

  return {footerMenu, headerMenu, shopName};
}

const SHOP_QUERY = gql`
  fragment MenuItem on MenuItem {
    id
    resourceId
    tags
    title
    type
    url
  }
  query layoutMenus(
    $language: LanguageCode
    $headerMenuHandle: String!
    $footerMenuHandle: String!
  ) @inContext(language: $language) {
    shop {
      name
    }
    headerMenu: menu(handle: $headerMenuHandle) {
      id
      items {
        ...MenuItem
        items {
          ...MenuItem
        }
      }
    }
    footerMenu: menu(handle: $footerMenuHandle) {
      id
      items {
        ...MenuItem
        items {
          ...MenuItem
        }
      }
    }
  }
`;
