import {useState, useEffect} from 'react';
import {Link} from '@shopify/hydrogen';
import {useCart} from '@shopify/hydrogen/client';
import axios from 'axios';
import getSymbolFromCurrency from 'currency-symbol-map';

import {
  isFuture,
  sortByDateProperty,
  dayjs,
  getUsaStandard,
  getISO,
} from '~/utils/dates';

import Loading from '~/components/Loading/index.client';

const caching_server =
  'https://bundle-api-cache-data.s3.us-west-2.amazonaws.com';
const platform_product_id = 8022523347235;

export function OrderBundles({discountCodes}) {
  console.log('discountCodes', discountCodes);
  const [deliveryDates, setDeliveryDates] = useState([]);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(-1);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [bundleData, setBundleData] = useState();
  const [bundleContents, setBundleContents] = useState([]);

  const [bundle, setBundle] = useState(null);
  const [products, setProducts] = useState([]);
  const [priceType, setPriceType] = useState();
  const [frequencyValue, setFrequencyValue] = useState('7 Day(s)');
  const [productsInCart, setProductsInCart] = useState([]);

  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);
  const [isDeliveryDateEditing, setIsDeliveryDateEditing] = useState(false);
  const [isProductsLoading, setIsProductsLoading] = useState(false);

  const {
    id,
    cartCreate,
    lines,
    linesAdd,
    linesUpdate,
    linesRemove,
    cartAttributesUpdate,
    discountCodesUpdate,
    cost,
    checkoutUrl,
  } = useCart();

  useEffect(() => {
    async function fetchAll() {
      await fetchDeliveryDates();
      await fetchBundle();
      setIsInitialDataLoading(false);
    }

    fetchAll();
  }, []);

  useEffect(() => {
    setIsProductsLoading(true);
    console.log('bundleContents: ', bundleContents);
    const contents = [...bundleContents].filter((content) => {
      return dayjs(deliveryDate).isBetween(
        content.deliver_after,
        content.deliver_before,
      );
    });

    fetchContents(contents);
  }, [deliveryDate]);

  useEffect(() => {
    initCart();
  }, [bundle]);

  useEffect(() => {
    initCart();
  }, [priceType, frequencyValue]);

  const weeks = [...new Array(6)]
    .map((_, weekIndex) =>
      [...new Array(7)].map((_, dayIndex) =>
        getISO(dayjs().weekday(7 * weekIndex + dayIndex)),
      ),
    )
    .filter(
      (week) =>
        !week.every((weekDate) =>
          deliveryDates.findIndex(
            (deliveryDate) => weekDate === deliveryDate.date,
          ) !== -1
            ? false
            : true,
        ),
    );

  async function initCart() {
    if (bundle) {
      const sellingPlanId =
        priceType === 'recuring'
          ? bundle.sellingPlanGroups.nodes[0]?.sellingPlans?.nodes?.find(
              (el) => el.options[0].value === frequencyValue,
            )?.id
          : undefined;

      await discountCodesUpdate(discountCodes);
      await cartCreate({
        lines: [
          {
            merchandiseId: bundle.variants.nodes[0].id,
            sellingPlanId,
          },
        ],
      });
    }
  }

  async function fetchDeliveryDates() {
    const res = (await axios.get(`${caching_server}/delivery_dates_dev.json`))
      .data;

    const data = sortByDateProperty(
      res.filter((el) => isFuture(el.date)),
      'date',
    );

    setDeliveryDates(data);
  }

  async function fetchBundle() {
    const bundleDataRes = (
      await axios.get(`${caching_server}/bundles_dev.json`)
    ).data.find((el) => el.platform_product_id === platform_product_id);

    setBundleData(bundleDataRes);

    const config = (
      await axios.get(
        `/api/bundle/bundles/${bundleDataRes.id}/configurations/${bundleDataRes.configurations[0].id}`,
      )
    ).data;

    setBundleContents(config.contents);
  }

  async function fetchContents(contents) {
    const product_ids = [];

    for await (const content of contents) {
      const res = (
        await axios.get(
          `/api/bundle/bundles/${bundleData.id}/configurations/${bundleData.configurations[0].id}/contents/${content.id}/products`,
        )
      ).data;

      res.every((el) => product_ids.push(el.platform_product_id));
    }

    if (product_ids.length) {
      const bundle_id = `gid://shopify/Product/${bundleData.platform_product_id}`;
      const {
        data: {bundle, products},
      } = await axios.post(`/api/products/bundle-products`, {
        bundle_id,
        product_ids,
      });

      setBundle(bundle);
      setProducts(products);
    } else {
      setBundle(null);
      setProducts([]);
    }

    setProductsInCart([]);
    setIsProductsLoading(false);
  }

  function handleWeekChange(e) {
    const week = weeks[e.target.value];

    const slots = deliveryDates.filter(
      (deliveryDate) => week.findIndex((el) => deliveryDate.date === el) !== -1,
    );

    setSelectedWeekIndex(e.target.value);
    setAvailableSlots(slots);
    setDeliveryDate(slots[0].date);

    setIsDeliveryDateEditing(false);
  }

  async function handleUpdateCart(product, diff) {
    let newProductsInCart = [...productsInCart];

    const productIndex = newProductsInCart.findIndex(
      (el) => el.variants.nodes[0].id === product.variants.nodes[0].id,
    );

    if (typeof diff === 'undefined') {
      // if the selected product doesn't exist in cart
      newProductsInCart.push({...product, quantity: 1});
    } else {
      // if the selected product exists in cart
      const quantity = (newProductsInCart[productIndex].quantity += diff);
      if (quantity === 0) {
        newProductsInCart = newProductsInCart.filter(
          (el, index) => index !== productIndex,
        );
      }
    }

    setProductsInCart(newProductsInCart);
  }

  function handleToggleFrequency() {
    setFrequencyValue(frequencyValue === '7 Day(s)' ? '14 Day(s)' : '7 Day(s)');
  }

  async function handleCheckout() {
    if (!productsInCart.length) {
      alert('Please select at least one meal.');
      return;
    }
    if (typeof priceType === 'undefined') {
      alert('Please choose a price type.');
      return;
    }

    window.open(checkoutUrl, '_blank');
  }

  return (
    <section className="py-20 bg-[#EFEFEF]">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap -mx-4 mb-24">
          <div className="w-full px-4 mb-8 md:mb-0 md:w-1/1 xl:w-1/3 lg:w-1/3">
            <div className="relative mb-10" style={{height: 564}}>
              <button
                className="absolute top-1/2 left-0 ml-8 transform translate-1/2"
                href="#"
              >
                <svg
                  width={10}
                  height={18}
                  viewBox="0 0 10 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 16.0185C9.268 16.2905 9.268 16.7275 9 16.9975C8.732 17.2675 8.299 17.2685 8.031 16.9975L0.201 9.0895C-0.067 8.8195 -0.067 8.3825 0.201 8.1105L8.031 0.2025C8.299 -0.0675 8.732 -0.0675 9 0.2025C9.268 0.4735 9.268 0.9115 9 1.1815L1.859 8.6005L9 16.0185Z"
                    fill="#1F40FF"
                  />
                </svg>
              </button>
              <img
                className="object-cover w-full h-full"
                src="https://res.cloudinary.com/meals/image/upload/f_auto,q_auto/fb/web/shop/shop_hero.png"
                alt="img"
              />
              <button
                className="absolute top-1/2 right-0 mr-8 transform translate-1/2"
                href="#"
              >
                <svg
                  width={10}
                  height={18}
                  viewBox="0 0 10 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0.19922 1.1817C-0.0687795 0.909696 -0.0687794 0.472695 0.19922 0.202695C0.46722 -0.0673054 0.90022 -0.0683048 1.16822 0.202695L8.99822 8.11069C9.26622 8.3807 9.26622 8.81769 8.99822 9.08969L1.16822 16.9977C0.900219 17.2677 0.467218 17.2677 0.199219 16.9977C-0.0687809 16.7267 -0.0687808 16.2887 0.199219 16.0187L7.34022 8.5997L0.19922 1.1817Z"
                    fill="#1F40FF"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="w-full px-4 md:w-1/1 xl:w-2/3 lg:w-2/3">
            <div className="xl:pl-10">
              <Loading isLoading={isInitialDataLoading}>
                <div className="mb-10 pb-10">
                  <div style={{backgroundColor: '#EFEFEF', padding: '20px 0'}}>
                    <div className="mb-6 bg-grey" style={{maxWidth: '100%'}}>
                      <div
                        className="block text-gray-800 text-lg font-bold mb-2"
                        style={{fontSize: 24}}
                      >
                        1. Choose your Week
                      </div>
                      <div
                        className="relative"
                        style={{boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)'}}
                      >
                        <select
                          className="appearance-none block w-full py-4 pl-6 mb-2 text-md text-darkgray-400 bg-white"
                          name="week"
                          onChange={handleWeekChange}
                          value={selectedWeekIndex}
                          style={{borderWidth: 0, backgroundImage: 'none'}}
                        >
                          <option disabled value={-1}>
                            --Choose an option--
                          </option>
                          {weeks.map((week, key) => (
                            <option key={key} value={key}>
                              {getUsaStandard(week[0])} -{' '}
                              {getUsaStandard(week[6])}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                          <svg
                            className="fill-current h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        backgroundColor: '#EFEFEF',
                        paddingBottom: 20,
                        textAlign: 'center',
                      }}
                    >
                      <p className="mb-2 text-md text-gray-500" />
                      <div className="text-sm">
                        Delivery Day:{' '}
                        <strong>
                          {deliveryDate
                            ? getUsaStandard(deliveryDate)
                            : '---- -- --'}
                        </strong>
                      </div>
                      <div className="text-sm" style={{color: '#DB9707'}}>
                        <button
                          onClick={() =>
                            setIsDeliveryDateEditing(!isDeliveryDateEditing)
                          }
                        >
                          <u>Change Delivery Day</u>
                        </button>
                      </div>
                      <p />
                    </div>
                    {isDeliveryDateEditing && availableSlots.length > 0 && (
                      <div className="flex flex-wrap lg:flex-nowrap justify-around gap-4 -mx-4 -mb-4 md:mb-0 bg-white px-[26px] py-[20px]">
                        {availableSlots.map((slot, key) => (
                          <button
                            key={key}
                            className={`block w-full py-5 text-sm text-center uppercase font-bold leading-normal border-2 ${
                              deliveryDate === slot.date
                                ? 'text-white bg-[#DB9707]'
                                : 'text-[#DB9707]'
                            }  border-[#DB9707]`}
                            onClick={() => {
                              setDeliveryDate(slot.date);
                              setIsDeliveryDateEditing(false);
                            }}
                          >
                            {dayjs(slot.date).format('dddd')}
                            <br />
                            {getUsaStandard(slot.date)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div
                    className="block text-gray-800 text-lg font-bold mb-2"
                    style={{fontSize: 24, marginTop: 20}}
                  >
                    2. Choose your Meals
                  </div>
                  <Loading isLoading={isProductsLoading}>
                    <div className="flex flex-wrap -mx-2 -mb-2">
                      {products.length ? (
                        products.map((product, key) => (
                          <div
                            key={key}
                            className="flex w-1/3 lg:w-1/5 sm:w-1/3 md:w-1/3 p-2 text-center"
                          >
                            <div className="flex flex-col justify-between text-center">
                              <button
                                className="block text-center font-bold font-heading"
                                href="#"
                              >
                                <img
                                  className="mx-auto object-contain"
                                  src={
                                    product.variants.nodes[0].image
                                      ? product.variants.nodes[0].image?.url
                                      : 'https://www.freeiconspng.com/uploads/no-image-icon-6.png'
                                  }
                                  alt="img"
                                />
                                <h3 className="font-bold font-heading text-sm text-center">
                                  {product.title}
                                </h3>
                                <div className="text-center text-sm mb-2 ">
                                  Serves: 5
                                </div>
                              </button>
                              {productsInCart.findIndex(
                                (el) =>
                                  el.variants.nodes[0].id ===
                                  product.variants.nodes[0].id,
                              ) === -1 ? (
                                <div className="px-4 text-center">
                                  <button
                                    className="text-center text-white font-bold font-heading uppercase transition"
                                    href="#"
                                    style={{
                                      backgroundColor: '#DB9707',
                                      color: '#FFFFFF',
                                      width: 80,
                                      padding: '3px 21px',
                                    }}
                                    onClick={() => handleUpdateCart(product)}
                                  >
                                    Add+
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-center font-semibold font-heading">
                                  <button
                                    className="hover:text-gray-700 text-center bg-[#DB9707] text-white"
                                    onClick={() =>
                                      handleUpdateCart(product, -1)
                                    }
                                  >
                                    <svg
                                      width={24}
                                      height={2}
                                      viewBox="0 0 12 2"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g opacity="0.35">
                                        <rect
                                          x={12}
                                          width={2}
                                          height={12}
                                          transform="rotate(90 12 0)"
                                          fill="currentColor"
                                        />
                                      </g>
                                    </svg>
                                  </button>
                                  <div className="w-8 m-0 px-2 py-[2px] text-center border-0 focus:ring-transparent focus:outline-none bg-white text-gray-500">
                                    {
                                      productsInCart.find(
                                        (el) =>
                                          el.variants.nodes[0].id ===
                                          product.variants.nodes[0].id,
                                      ).quantity
                                    }
                                  </div>
                                  <button
                                    className="hover:text-gray-700 text-center bg-[#DB9707] text-white"
                                    onClick={() => handleUpdateCart(product, 1)}
                                  >
                                    <svg
                                      width={24}
                                      height={12}
                                      viewBox="0 0 12 12"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g opacity="0.35">
                                        <rect
                                          x={5}
                                          width={2}
                                          height={12}
                                          fill="currentColor"
                                        />
                                        <rect
                                          x={12}
                                          y={5}
                                          width={2}
                                          height={12}
                                          transform="rotate(90 12 5)"
                                          fill="currentColor"
                                        />
                                      </g>
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="w-full flex justify-center items-center py-8 text-lg">
                          <div>No available products</div>
                        </div>
                      )}
                    </div>
                  </Loading>
                  <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto">
                      <div
                        className="block text-gray-800 text-lg font-bold mb-2 -ml-4"
                        style={{fontSize: 24, marginTop: 60}}
                      >
                        3. Choose your Price
                      </div>
                      <div className="flex flex-wrap -mx-4 mb-24">
                        <div className="w-full px-2">
                          <div className="relative  bg-gray-50">
                            <div
                              className="px-6 py-4 mt-8"
                              style={{
                                boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)',
                                border: 'solid #DB9707 4px',
                              }}
                            >
                              <span
                                className="font-bold"
                                style={{
                                  float: 'right',
                                  backgroundColor: '#DB9725',
                                  color: '#FFFFFF',
                                  padding: '4px 44px',
                                  marginTop: '-48px',
                                  marginRight: '-28px',
                                }}
                              >
                                Most Popular
                              </span>
                              {/*---radio---*/}
                              <div className="mb-1">
                                <div
                                  className="mb-1"
                                  style={{color: '#000000'}}
                                >
                                  <div className="flex flex-wrap -mx-4 -mb-4 md:mb-0">
                                    <div className="w-full md:w-2/3 px-4 mb-4 md:mb-0">
                                      {' '}
                                      <label>
                                        <input
                                          id="subscribe_save"
                                          type="radio"
                                          name="price_type"
                                          value="recuring"
                                          checked={priceType === 'recuring'}
                                          onClick={(e) =>
                                            setPriceType(e.target.value)
                                          }
                                        />
                                        <span
                                          className="ml-3 font-bold"
                                          style={{fontSize: 18}}
                                        >
                                          SUBSCRIBE &amp; SAVE
                                        </span>
                                        <br />
                                        <div style={{paddingBottom: 14}}>
                                          <span>
                                            <strike>$189.95</strike>
                                          </span>
                                          <span
                                            className="font-bold"
                                            style={{fontSize: 18}}
                                          >
                                            {' '}
                                            $169.95 /{' '}
                                          </span>
                                          <span>4 meals</span>
                                        </div>
                                      </label>
                                    </div>
                                    <div className="w-full md:w-1/3 px-4 mb-4 md:mb-0">
                                      <span
                                        className="font-bold"
                                        style={{
                                          float: 'right',
                                          backgroundColor: '#DB9725',
                                          color: '#FFFFFF',
                                          padding: '10px 6px',
                                          marginTop: '-8px',
                                        }}
                                      >
                                        $8.50/Serving
                                      </span>
                                    </div>
                                  </div>
                                  <hr />
                                  <p style={{color: '#DB9725', marginTop: 10}}>
                                    <span
                                      style={{fontSize: 18}}
                                      className=" font-bold"
                                    >
                                      Limited Time Promotion:
                                    </span>{' '}
                                    <br />
                                    Get a FREE Breakfast with the life of your
                                    Subscription. (A $60.00 value)
                                  </p>
                                  <br />
                                  <p>
                                    Delivery Every:{' '}
                                    <button
                                      className={`text-[#DB9725]`}
                                      onClick={handleToggleFrequency}
                                    >
                                      <u>
                                        {' '}
                                        {frequencyValue === '7 Day(s)'
                                          ? 'Weekly'
                                          : 'Biweekly'}
                                      </u>{' '}
                                      &gt;{' '}
                                    </button>
                                  </p>
                                  <p>Save $20</p>
                                  <p>No Commitments, Cancel Anytime</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-full mb-20 px-2">
                          <div className="relative  bg-gray-50">
                            <div
                              className="px-6 py-4 mt-8"
                              style={{
                                boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)',
                                border: 'solid #DB9707 4px',
                              }}
                            >
                              <div className="mb-1">
                                <div
                                  className="mb-1"
                                  style={{color: '#000000'}}
                                >
                                  <div className="flex flex-wrap -mx-4 -mb-4 md:mb-0">
                                    <div className="w-full md:w-2/3 px-4 mb-4 md:mb-0">
                                      {' '}
                                      <label>
                                        <input
                                          id="one-time"
                                          type="radio"
                                          name="price_type"
                                          value="onetime"
                                          checked={priceType === 'onetime'}
                                          onClick={(e) =>
                                            setPriceType(e.target.value)
                                          }
                                        />
                                        <span
                                          className="ml-3 font-bold"
                                          style={{fontSize: 18}}
                                        >
                                          ONE-TIME
                                        </span>
                                        <br />
                                        <span
                                          className="font-bold"
                                          style={{fontSize: 18}}
                                        >
                                          $189.95 /{' '}
                                        </span>
                                        <span>3 meals</span>
                                      </label>
                                    </div>
                                    <div className="w-full md:w-1/3 px-4 mb-4 md:mb-0">
                                      <span
                                        className="font-bold"
                                        style={{
                                          float: 'right',
                                          backgroundColor: '#DB9725',
                                          color: '#FFFFFF',
                                          padding: '10px 6px',
                                          marginTop: '-8px',
                                        }}
                                      >
                                        $12.66/Serving
                                      </span>
                                    </div>
                                  </div>
                                  <hr />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="w-full mb-4 md:mb-0">
                      <span className="font-bold" style={{fontSize: 18}}>
                        You&apos;re Saving $20!
                      </span>
                      <span className="font-bold" style={{float: 'right'}}>
                        Total:{' '}
                        {getSymbolFromCurrency(
                          cost?.totalAmount?.currencyCode,
                        ) + cost?.totalAmount?.amount}
                      </span>
                    </div>
                    <div className="w-full mb-4 md:mb-0">
                      <button
                        className="block w-full py-5 text-lg text-center uppercase font-bold "
                        href="#"
                        style={{
                          backgroundColor: '#DB9707',
                          color: '#FFFFFF',
                          marginTop: 10,
                        }}
                        onClick={handleCheckout}
                      >
                        CHECKOUT
                      </button>
                    </div>
                    <div>
                      <div
                        className="block text-gray-800 text-lg font-bold mb-2"
                        style={{
                          fontSize: 24,
                          marginTop: 60,
                          textAlign: 'center',
                        }}
                      >
                        <u>100% Money-Back Guarantee</u>
                      </div>
                      <div
                        name="money_hidden"
                        className="w-full  text-center"
                        style={{
                          backgroundColor: '#FFFFFF',
                          padding: 40,
                          marginTop: 30,
                          boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)',
                        }}
                      >
                        <p style={{fontSize: 36}} className="font-bold">
                          100% Money Back Guarantee
                        </p>
                        <br />
                        <p style={{fontSize: 22}} className="font-bold">
                          We stand by our delicious food, and the good we are
                          doing feeding families across the country.
                        </p>
                        <br />
                        <p style={{fontSize: 20}}>
                          Get a full refund for your FEASTbox if you don’t love
                          our food. Eating good shouldn’t be stressful, so we
                          want to make it as easy as possible.{' '}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Loading>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}