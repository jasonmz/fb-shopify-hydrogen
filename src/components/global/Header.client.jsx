import {Menu, Transition} from '@headlessui/react';
import {Image, Link, useCart, useUrl} from '@shopify/hydrogen';
import React, {Fragment} from 'react';
import {useWindowScroll} from 'react-use';
import {LogoutButton} from '~/components';

import {Heading, IconAccount, IconMenu} from '~/components';

import {CartDrawer} from './CartDrawer.client';
import {useDrawer} from './Drawer.client';
import {MenuDrawer} from './MenuDrawer.client';

/**
 * A client component that specifies the content of the header on the website
 */
export function Header({title, token}) {
  const menu = {
    id: 'gid://shopify/Menu/180186611768',
    items: [
      {
        id: 'gid://shopify/MenuItem/413612474424',
        target: '_self',
        title: 'Menu',
        to: '/menus',
      },
      {
        id: 'gid://shopify/MenuItem/413612507192',
        target: '_self',
        title: 'How It Works',
        to: '/how-it-works',
      },
      {
        id: 'gid://shopify/MenuItem/413612507455',
        target: '_self',
        title: 'Catering',
        to: '/catering',
      },
      {
        id: 'gid://shopify/MenuItem/430541078584',
        target: '_self',
        title: 'About Us',
        to: '/about-us',
      },
    ],
  };

  const {pathname} = useUrl();

  const localeMatch = /^\/([a-z]{2})(\/|$)/i.exec(pathname);
  const countryCode = localeMatch ? localeMatch[1] : undefined;

  const isHome = pathname === `/${countryCode ? countryCode + '/' : ''}`;

  const {
    isOpen: isCartOpen,
    openDrawer: openCart,
    closeDrawer: closeCart,
  } = useDrawer();

  const {
    isOpen: isMenuOpen,
    openDrawer: openMenu,
    closeDrawer: closeMenu,
  } = useDrawer();

  return (
    <>
      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
      <MenuDrawer isOpen={isMenuOpen} onClose={closeMenu} menu={menu} />
      <DesktopHeader
        countryCode={countryCode}
        isHome={isHome}
        title={title}
        menu={menu}
        openCart={openCart}
        token={token}
      />
      <MobileHeader
        countryCode={countryCode}
        isHome={isHome}
        title={title}
        openCart={openCart}
        openMenu={openMenu}
        token={token}
      />
    </>
  );
}

function MobileHeader({countryCode, title, isHome, openCart, openMenu, token}) {
  const {y} = useWindowScroll();

  const styles = {
    container: `${
      isHome
        ? 'bg-[#121111] text-contrast text-primary shadow-darkHeader'
        : 'bg-[#121111] text-contrast text-primary shadow-darkHeader'
    } ${
      y > 50 && !isHome ? 'shadow-lightHeader ' : ''
    }flex lg:hidden items-center h-nav sticky backdrop-blur-lg z-40 top-0 justify-between w-full leading-none gap-4 px-4 md:px-8`,
  };

  const ref = React.createRef();

  return (
    <header role="banner" className={styles.container}>
      <div className="flex items-center justify-start w-full gap-4">
        <button
          onClick={openMenu}
          className="relative flex items-center justify-center w-8 h-8"
        >
          <IconMenu />
        </button>
        <Link to='/'>
        <Image
          src="https://res.cloudinary.com/meals/image/upload/f_auto,q_auto,w_75/fb/logo/fb_logo_white.png"
          width={'auto'}
          height={'auto'}
          alt={'Feastbox'}
          className="w-16"
          />
        </Link>
      </div>


      <div className="flex items-center justify-end w-full gap-4">
        <Link
          to={'/shop/bundle/family-feastbox'}
          className="truncate text-white border font-bold py-2 px-2 focus:outline-none"
        >
          Get Started
        </Link>
        <Menu as="div" className="relative inline-block text-left">
          <div>
            <Menu.Button className="flex items-center text-gray-400  focus:outline-none ">
              <IconAccount />
            </Menu.Button>
          </div>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="bg-[#121111] absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div className="py-1 bg-[#121111]">
                <Menu.Item>
                  {({active}) => (
                    <Link
                      to={'/account/subscriptions'}
                      className={`block px-4 py-2 text-sm ${
                        active ? 'bg-gray-700 text-white' : 'text-white'
                      }`}
                    >
                      Account
                    </Link>
                  )}
                </Menu.Item>
                {!token ? (
                  <Menu.Item>
                    {({active}) => (
                      <Link
                        to={'/account/login'}
                        className={`block px-4 py-2 text-sm ${
                          active ? 'bg-gray-700 text-white' : 'text-white'
                        }`}
                      >
                        Login
                      </Link>
                    )}
                  </Menu.Item>
                ) : (
                  <Menu.Item>
                    {({active}) => <LogoutButton ref={ref} active={active} />}
                  </Menu.Item>
                )}
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
        {/* <button
          onClick={openCart}
          className="relative flex items-center justify-center w-8 h-8"
        >
          <IconBag />
          <CartBadge dark={isHome} />
        </button> */}
      </div>
    </header>
  );
}

function DesktopHeader({countryCode, isHome, menu, openCart, title, token}) {
  const {y} = useWindowScroll();

  const styles = {
    button:
      'relative flex items-center justify-center w-8 h-8 focus:ring-primary/5',
    container: `${
      isHome
        ? 'bg-[#121111] text-contrast text-primary shadow-darkHeader'
        : 'bg-[#121111] text-contrast text-primary shadow-darkHeader'
    } ${
      y > 50 && !isHome ? 'shadow-lightHeader ' : 'shadow-lightHeader '
    }hidden lg:flex items-center sticky transition duration-300 backdrop-blur-lg z-40 top-0 justify-between w-full leading-none gap-8 px-12 py-3`,
  };

  const ref = React.createRef();

  return (
    <header role="banner" className={styles.container}>
      <div className="flex gap-1">
        <Link className={`font-bold`} to="/">
          <Image
            src="https://res.cloudinary.com/meals/image/upload/f_auto,q_auto,w_75/fb/logo/fb_logo_white.png"
            width={'auto'}
            height={'auto'}
            alt={'Feastbox'}
          />
        </Link>
      </div>
      <div className="flex gap-2 ml-auto font-light text-white">
        <nav className="flex items-right gap-8">
          {/* Top level menu items */}
          {(menu?.items || []).map((item, key) => (
            <Link
              key={key}
              className={'font-bold'}
              to={item.to}
              target={item.target}
            >
              {item.title}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2 font-light">
        <Link
          to={'/shop/bundle/family-feastbox'}
          className=" text-white border font-bold py-3 px-8 focus:outline-none"
        >
          Get Started
        </Link>
        <Link
          to={'/shop/bundle'}
          className="text-sm inline-block bg-white text-black py-1 px-4 uppercase text-xs hidden"
        >
          SHOP NOW
        </Link>

        <Menu as="div" className="relative inline-block text-left">
          <div>
            <Menu.Button className="flex items-center text-gray-400  focus:outline-none ">
              <IconAccount />
            </Menu.Button>
          </div>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div className="py-1 bg-[#121111]">
                {!token ? (
                  <Menu.Item>
                    {({active}) => (
                      <Link
                        to={'/account/login'}
                        className={`block px-4 py-2 text-sm ${
                          active ? 'bg-gray-700 text-white' : 'text-white'
                        }`}
                      >
                        Login
                      </Link>
                    )}
                  </Menu.Item>
                ) : (
                  <>
                    <Menu.Item>
                      {({active}) => (
                        <Link
                          to={'/account/subscriptions'}
                          className={`block px-4 py-2 text-sm ${
                            active ? 'bg-gray-700 text-white' : 'text-white'
                          }`}
                        >
                          Account
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({active}) => <LogoutButton ref={ref} active={active} />}
                    </Menu.Item>
                  </>
                )}
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
        {/* 
        <button
          onClick={openCart}
          className="relative flex items-center justify-center w-8 h-8"
        >
          <IconBag />
          <CartBadge dark={isHome} />
        </button> */}
      </div>
    </header>
  );
}

function CartBadge({dark}) {
  const {totalQuantity} = useCart();

  if (totalQuantity < 1) {
    return null;
  }

  return (
    <div
      className={`${
        dark
          ? 'text-black text-contrast bg-[#ffffff]'
          : 'text-black text-contrast bg-[#ffffff]'
      } absolute bottom-1 right-0 text-[0.625rem] font-bold subpixel-antialiased h-5 min-w-[1.25rem] flex items-center justify-center leading-none text-center rounded-full w-auto pb-px`}
    >
      <span>{totalQuantity}</span>
    </div>
  );
}
