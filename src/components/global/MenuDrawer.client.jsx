import {Text} from '~/components';
import {Drawer} from './Drawer.client';
import {Link} from '@shopify/hydrogen';
import {startTransition} from 'react';

export function MenuDrawer({isOpen, onClose, menu}) {
  return (
    <Drawer open={isOpen} onClose={onClose} openFrom="left" heading="Menu">
      <div className="grid">
        <MenuMobileNav menu={menu} onClose={onClose} />
      </div>
    </Drawer>
  );
}

function MenuMobileNav({menu, onClose}) {
  return (
    <nav className="grid gap-4 p-6 sm:gap-6 sm:px-12 sm:py-8">
      {/* Top level menu items */}
      {(menu?.items || []).map((item) => (
        <Link
          key={item.id}
          to={item.to}
          target={item.target}
          onClick={() => startTransition(onClose)}
        >
          <Text as="span" size="copy">
            {item.title}
          </Text>
        </Link>
      ))}
      <Link
        to={'/shop/bundle'}
        className=" text-sm inline-block bg-black text-white px-2 py-2 uppercase"
      >
        Get Started
      </Link>
    </nav>
  );
}
