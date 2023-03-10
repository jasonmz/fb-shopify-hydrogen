import {useCart, Link} from '@shopify/hydrogen/client';
import {useState, useEffect, useRef} from 'react';
import axios from 'axios';

import {
  today,
  // isFuture,
  // sortByDateProperty,
  formatUTCDate,
  getNextWeekDay,
  dayjs,
  getUsaStandard,
  getISO,
  getDayUsa,
} from '~/utils/dates';
import {getFullCost} from '~/utils/cost';
import Loading from '~/components/Loading/index.client';
import {MealItem} from './MealItem.client';
import MoneyBackModal from './MoneyBackModal';
import Spinner from '~/components/spinner/button';

const LEAD_TIME = 3; // 3 days ahead of selecting delivery dates
const caching_server =
  'https://bundle-api-cache-data.s3.us-west-2.amazonaws.com';

const API_CALLING_INTERVAL = 1300;

function getCartInfo(param) {
  if (typeof window !== 'undefined') {
    const localStorageCartInfo = localStorage.getItem('cartInfo');
    const savedCartInfo =
      localStorageCartInfo !== null ? JSON.parse(localStorageCartInfo) : null;
    if (
      savedCartInfo !== null &&
      typeof savedCartInfo[param.handle] !== 'undefined'
    ) {
      const {deliveryDate} = savedCartInfo[param.handle];
      if (dayjs().isBefore(deliveryDate)) {
        return savedCartInfo;
      }
    }
  }

  return {
    [param.handle]: {
      cartId: undefined,
      handle: param.handle,
      bundleContents: [],
      bundleData: undefined,
      deliveryDate: '',
      priceType: 'onetime',
      frequencyValue: '7 Day(s)',
      totalPrice: 0,
      meals: [],
      mealQuantity: 0,
      variantIndex: 0,
    },
  };
}

export function OrderBundles({
  bundle,
  discountCodes,
  customerAccessToken,
  customerId = '',
  CDN_CACHE_ENV_MODE,
}) {
  const [deliveryDates, setDeliveryDates] = useState([]);
  const [products, setProducts] = useState([]);
  const [showMoneyBackModal, setShowMoneyBackModal] = useState(false);

  const [cartInfo, setCartInfo] = useState(
    getCartInfo({handle: bundle.handle}),
  );

  const [newDiscountCodes, setNewDiscountCodes] = useState(discountCodes);

  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);
  const [isDeliveryDateEditing, setIsDeliveryDateEditing] = useState(false);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);
  const [isCartCreated, setIsCartCreated] = useState(false);
  const [selectedGray, setSelectedGray] = useState(2);

  const handleSelectGray = (index) => {
    setSelectedGray(index);
  };

  const [errors, setErrors] = useState({
    discountCode: '',
  });

  const {
    id,
    lines,
    checkoutUrl,
    cartCreate,
    linesUpdate,
    cartAttributesUpdate,
    buyerIdentityUpdate,
    discountCodesUpdate,
  } = useCart();

  const isCartCreatedRef = useRef(false);
  isCartCreatedRef.current = isCartCreated;

  const idRef = useRef(null);
  idRef.current = id;

  const cartInfoRef = useRef(null);
  cartInfoRef.current = cartInfo;

  const discountCodeInputRef = useRef(null);

  const bundleIdNumber = Number(bundle.id.substring(22));

  const currentQuantity = (() => {
    let quantity = 0;
    cartInfo[bundle.handle].meals.forEach((el) => (quantity += el.quantity));
    return quantity;
  })();

  const isQuantityLimit = (() => {
    return currentQuantity === cartInfo[bundle.handle].mealQuantity;
  })();

  const weeks = [...new Array(6)]
    .map((_, weekIndex) =>
      [...new Array(7)].map((_, dayIndex) =>
        getISO(dayjs().weekday(7 * weekIndex + dayIndex)),
      ),
    )
    .filter(
      (week) =>
        !week.every((weekDate) =>
          deliveryDates.findIndex((el) => weekDate === el.date) !== -1
            ? false
            : true,
        ),
    );

  const selectedWeekIndex = weeks.findIndex(
    (week) =>
      week.findIndex((el) => el === cartInfo[bundle.handle].deliveryDate) !==
      -1,
  );

  const availableSlots = (() => {
    if (selectedWeekIndex !== -1) {
      const week = weeks[selectedWeekIndex];

      const slots = deliveryDates.filter(
        (deliveryDate) =>
          week.findIndex((el) => deliveryDate.date === el) !== -1,
      );
      return slots;
    }
    return [];
  })();

  const totalPrice = (() => {
    let price =
      bundle.variants.nodes[cartInfo[bundle.handle].variantIndex]?.priceV2
        .amount;
    if (cartInfo[bundle.handle].priceType === 'recuring') {
      price =
        price -
        (price *
          bundle.sellingPlanGroups.nodes[0]?.sellingPlans?.nodes?.find(
            (el) =>
              el.options[0].value === cartInfo[bundle.handle].frequencyValue,
          )?.priceAdjustments[0]?.adjustmentValue?.adjustmentPercentage) /
          100;
      price = price.toFixed(3);
    }

    return parseFloat(price);
  })();

  const cartId =
    typeof window !== 'undefined'
      ? localStorage.getItem('shopifyCartId')
      : null;

  useEffect(() => {
    if (cartId === null) {
      createInitialCart();
    }

    fetchAll();

    async function fetchAll() {
      await fetchDeliveryDates();
      await fetchBundle();
      setIsInitialDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof id !== 'undefined') {
      if (
        typeof cartInfo[bundle.handle].cartId === 'undefined' &&
        isCartCreatedRef.current === false
      ) {
        createInitialCart();
      } else {
        discountCodesUpdate(discountCodes);
      }
    }
  }, [id]);

  useEffect(() => {
    const oldCartInfo = localStorage.getItem('cartInfo');
    // const savingCartInfo = oldCartInfo !== null ? JSON.parse(oldCartInfo) : {};
    const savingCartInfo = oldCartInfo !== null ? {} : {};
    savingCartInfo[bundle.handle] = cartInfo[bundle.handle];
    localStorage.setItem('cartInfo', JSON.stringify(savingCartInfo));
  }, [cartInfo]);

  useEffect(() => {
    if (selectedWeekIndex !== -1) {
      setIsProductsLoading(true);

      let contentResult = [];
      [...cartInfo[bundle.handle].bundleContents].filter((content) => {
        const dateNow = new Date(cartInfo[bundle.handle].deliveryDate);
        const deliverAfter = new Date(content.deliver_after);
        const deliverBefore = new Date(content.deliver_before);

        if (dateNow > deliverAfter && dateNow < deliverBefore) {
          contentResult = [content];
        }
      });

      fetchContents(contentResult);
    }
  }, [selectedWeekIndex]);

  function createInitialCart() {
    cartCreate({
      lines: [
        {
          merchandiseId:
            bundle.variants.nodes[cartInfo[bundle.handle].variantIndex].id,
        },
      ],
    });
    setIsCartCreated(true);
  }

  function identifyDiscountAmount() {
    if (typeof newDiscountCodes != 'undefined' && newDiscountCodes.length > 0) {
      return 40;
    } else {
      return 0;
    }
  }

  function getAttributes(cartToken, customerId, deliveryDate) {
    deliveryDate =
      cartInfo[bundle.handle].deliveryDate !== '' ? deliveryDate : today();
    cartToken = cartToken !== '' ? cartToken.substring(19) : 'xxx';
    customerId =
      customerId !== '' ? customerId.substring(23) : 'unauthenticated customer';
    const purchaseType =
      cartInfo[bundle.handle]?.priceType === 'recuring'
        ? 'Recurring'
        : 'Onetime';
    const frequency =
      cartInfo[bundle.handle]?.priceType === 'recuring'
        ? cartInfo[bundle.handle].frequencyValue
        : 'N/A';
    const selectedMeals = cartInfo[bundle.handle].meals.map((el) => {
      return {
        title: el.variants.nodes[
          cartInfo[bundle.handle].variantIndex
        ]?.metafields?.find((x) => x?.key === 'display_name')?.value,
        qty: el.quantity,
      };
    });
    const mealsProperties = selectedMeals.map((meal, index) => {
      return meal.title + ' (qty: ' + meal.qty + ') ';
    });

    return [
      {
        key: 'Selected Meals',
        value: mealsProperties.toString(), //delivery date format will be 2022-12-26
      },
      {
        key: 'Delivery_Date',
        value: deliveryDate, //delivery date format will be 2022-12-26
      },
      {
        key: 'Cart Token',
        value: cartToken, // issue on checkout without updating cart
      },
      {
        key: 'Purchase Type',
        value: purchaseType, // issue on checkout without updating cart
      },
      {
        key: 'Frequency',
        value: frequency, // issue on checkout without updating cart
      },
    ];
  }

  async function fetchDeliveryDates() {
    const deliveryDateCacheUrl =
      CDN_CACHE_ENV_MODE === 'production'
        ? 'delivery_dates.json'
        : 'delivery_dates_dev.json';
    const res = (await axios.get(`${caching_server}/${deliveryDateCacheUrl}`))
      .data;

    const today = new Date();
    today.setHours(0);
    today.setMinutes(0);
    today.setSeconds(0);
    const todayDate = dayjs();
    const earliestAvailableDate = todayDate.add(LEAD_TIME, 'day');

    const filteredDates = res
      .filter((deliveryDate) => {
        const date = new Date(deliveryDate.date);
        return (
          date > today.getTime() && deliveryDate.quantity > deliveryDate.used
        );
      })
      .map((deliveryDate) => {
        deliveryDate.day = new Date(deliveryDate.date).getDay() + 1; // Add day since midnight is counting as previous day
        return deliveryDate;
      })
      .sort((a, b) => (new Date(a.date) < new Date(b.date) ? -1 : 1));

    const filteredDatesFinal = filteredDates.filter((deliveryDate) => {
      return earliestAvailableDate.isSameOrBefore(dayjs(deliveryDate.date));
    });

    setDeliveryDates(filteredDatesFinal);
  }

  async function fetchBundle() {
    const bundleCacheUrl =
      CDN_CACHE_ENV_MODE === 'production' ? 'bundles.json' : 'bundles_dev.json';
    const bundleDataRes = (
      await axios.get(`${caching_server}/${bundleCacheUrl}`)
    ).data.find((el) => el.platform_product_id === bundleIdNumber);
    const {data: config} = await axios.get(
      `/api/bundle/bundles/${bundleDataRes.id}/configurations/${bundleDataRes.configurations[0].id}`,
    );

    setCartInfo({
      ...cartInfoRef.current,
      [bundle.handle]: {
        ...cartInfoRef.current[bundle.handle],
        cartId: idRef.current,
        bundleData: bundleDataRes,
        bundleContents: config.contents,
        mealQuantity: config.quantity,
      },
    });
  }

  async function fetchContents(contents) {
    const product_ids = [];
    const config_ids = {};
    const bundle_config_content_ids = {};
    for await (const content of contents) {
      const res = (
        await axios.get(
          `/api/bundle/bundles/${
            cartInfo[bundle.handle].bundleData.id
          }/configurations/${
            cartInfo[bundle.handle].bundleData.configurations[0].id
          }/contents/${content.id}/products`,
        )
      ).data;

      res.map((el) => {
        product_ids.push(el.platform_product_id);
        config_ids[`gid://shopify/Product/${el.platform_product_id}`] =
          el.contents.bundle_configuration_id;
        bundle_config_content_ids[
          `gid://shopify/Product/${el.platform_product_id}`
        ] = el.bundle_configuration_contents_id;
      });
    }

    if (product_ids.length) {
      const {data: products} = await axios.post(`/api/products/multiple`, {
        product_ids,
      });

      setProducts(
        products.map((product) => ({
          ...product,
          bundleConfigurationId: config_ids[product.id],
          bundle_configuration_contents_id:
            bundle_config_content_ids[product.id],
        })),
      );
    } else {
      setProducts([]);
    }

    setCartInfo({
      ...cartInfo,
      [bundle.handle]: {...cartInfo[bundle.handle], meals: []},
    });
    setIsProductsLoading(false);
  }

  function handleWeekChange(e) {
    const newWeek = weeks[e.target.value];

    const newSlots = deliveryDates.filter(
      (deliveryDate) =>
        newWeek.findIndex((el) => deliveryDate.date === el) !== -1,
    );

    setCartInfo({
      ...cartInfo,
      [bundle.handle]: {
        ...cartInfo[bundle.handle],
        deliveryDate: newSlots[0].date,
        deliveryDay: newSlots[0].day,
      },
    });

    setIsDeliveryDateEditing(false);

    window.dataLayer.push({
      event: 'changeWeek',
      value: newWeek,
    });
  }

  function handlePartyChange(e) {
    setCartInfo({
      ...cartInfo,
      [bundle.handle]: {
        ...cartInfo[bundle.handle],
        variantIndex: Number(e.target.value),
      },
    });
  }

  async function handleUpdateCart(product, diff) {
    let newProductsInCart = [...cartInfo[bundle.handle].meals];

    const productIndex = newProductsInCart.findIndex(
      (el) =>
        el.variants.nodes[cartInfo[bundle.handle].variantIndex].id ===
        product.variants.nodes[cartInfo[bundle.handle].variantIndex].id,
    );

    if (typeof diff === 'undefined') {
      newProductsInCart.push({...product, quantity: 1});
    } else {
      const quantity = (newProductsInCart[productIndex].quantity += diff);
      if (quantity === 0) {
        newProductsInCart = newProductsInCart.filter(
          (el, index) => index !== productIndex,
        );
      }
    }

    setCartInfo({
      ...cartInfo,
      [bundle.handle]: {...cartInfo[bundle.handle], meals: newProductsInCart},
    });

    if (typeof diff === 'undefined' || diff !== -1) {
      window.dataLayer.push({
        event: 'addMeal',
      });
    } else {
      window.dataLayer.push({
        event: 'removeMeal',
      });
    }
  }

  function handleToggleFrequency() {
    if (cartInfo[bundle.handle].frequencyValue === '7 Day(s)') {
      window.dataLayer.push({
        event: 'deliveryBiWeekly',
      });
    } else {
      window.dataLayer.push({
        event: 'deliveryWeekly',
      });
    }

    setCartInfo({
      ...cartInfo,
      [bundle.handle]: {
        ...cartInfo[bundle.handle],
        frequencyValue:
          cartInfo[bundle.handle].frequencyValue === '7 Day(s)'
            ? '14 Day(s)'
            : '7 Day(s)',
      },
    });
  }

  function getVariantIndexDynamically() {
    let dynamicVariantIndex = cartInfo[bundle.handle].variantIndex;
    if (bundle.handle === 'event-feastbox') {
      dynamicVariantIndex = cartInfo[bundle.handle].variantIndex + 1;
    }
    return dynamicVariantIndex;
  }

  async function handleSubmitDiscountCode() {
    try {
      await axios.post(`/api/discount/set`, {
        cartId: id,
        code: discountCodeInputRef.current.value,
      });

      setNewDiscountCodes([discountCodeInputRef.current.value]);
      window.dataLayer.push({event: 'addCoupon'});
    } catch ({
      response: {
        data: {error},
      },
    }) {
      setErrors({...errors, discountCode: error});
      discountCodeInputRef.current.value = '';
    }
  }

  async function handleCheckout() {
    window.dataLayer.push({
      event: 'checkout',
    });

    setIsCheckoutProcessing(true);
    if (!cartInfo[bundle.handle].meals.length || !isQuantityLimit) {
      alert(`Please select ${cartInfo[bundle.handle].mealQuantity} meal(s).`);
      return;
    }
    if (typeof cartInfo[bundle.handle].priceType === 'undefined') {
      alert('Please choose a price type.');
      return;
    }

    const line = {
      merchandiseId:
        bundle.variants.nodes[cartInfo[bundle.handle].variantIndex].id,
      sellingPlanId: undefined,
      quantity: 1,
      attributes: getAttributes(
        id,
        customerId,
        cartInfo[bundle.handle].deliveryDate,
      ),
    };

    if (cartInfo[bundle.handle].priceType === 'recuring') {
      const sellingPlanId =
        bundle.sellingPlanGroups.nodes[0]?.sellingPlans?.nodes?.find(
          (el) =>
            el.options[0].value === cartInfo[bundle.handle].frequencyValue,
        )?.id;

      line.sellingPlanId = sellingPlanId;
    }

    const {id: lineId} = lines.find(
      (line) => line.merchandise.product.id === bundle.id,
    );

    let timeoutDeep = 0;

    linesUpdate([
      {
        ...line,
        id: lineId,
      },
    ]);

    setTimeout(() => {
      if (typeof customerAccessToken !== 'undefined') {
        timeoutDeep = 1;
        buyerIdentityUpdate({
          customerAccessToken,
        });
      }

      setTimeout(async () => {
        const attributes = [
          {
            key: 'delivery-date',
            value: formatUTCDate(
              cartInfo[bundle.handle].deliveryDate,
              'YYYY-MM-DD',
            ),
          },
          {
            key: 'delivery-day',
            value: cartInfo[bundle.handle].deliveryDay
              ? getNextWeekDay(cartInfo[bundle.handle]?.deliveryDay).format(
                  'dddd',
                )
              : 'N/A',
          },
        ];
        cartAttributesUpdate(attributes);

        const platform_cart_token = id.split('Cart/')[1]; //her id contains the cart ID eg. 'gid://shopify/Cart/79b3694342d6c8504670e7731c6e34e6'

        const items = cartInfo[bundle.handle].meals.map((el) => {
          // update variant index based on bundle product when bundle product is Family feastbox then variant index defaul
          // but when Event feastbox then variant index will +1 as meals variant for eventbox start from 1 index in shopify
          let dynamicVariantIndex = cartInfo[bundle.handle].variantIndex;
          if (bundle.handle === 'event-feastbox') {
            dynamicVariantIndex = cartInfo[bundle.handle].variantIndex + 1;
          }
          return {
            bundle_configuration_content_id:
              el.bundle_configuration_contents_id,
            platform_product_variant_id: parseInt(
              el.variants.nodes[dynamicVariantIndex]?.id.split(
                'ProductVariant/',
              )[1],
            ),
            quantity: el.quantity,
          };
        });

        const cartData = {
          platform_customer_id: null, //if customer logged in then save shopify customer idp
          platform_cart_token,
          platform_product_id:
            cartInfo[bundle.handle].bundleData.platform_product_id,
          platform_variant_id: parseInt(
            bundle.variants.nodes[
              cartInfo[bundle.handle].variantIndex
            ]?.id.split('ProductVariant/')[1],
          ), // The format is look like "gid://shopify/ProductVariant/43857870848291" but need only: 43857870848291 (int)
          subscription_type:
            bundle.variants.nodes[
              cartInfo[bundle.handle].variantIndex
            ]?.title.split(' /')[0],
          subscription_sub_type:
            bundle.variants.nodes[
              cartInfo[bundle.handle].variantIndex
            ]?.title.split('/ ')[1],
          bundle_id: cartInfo[bundle.handle].bundleData.id,
          delivery_day: getDayUsa(cartInfo[bundle.handle].deliveryDate),
          contents: [...items],
        };

        await axios.post(`/api/bundle/carts`, cartData);

        location.href = checkoutUrl;
      }, [API_CALLING_INTERVAL * timeoutDeep]);
    }, [API_CALLING_INTERVAL]);
  }

  return (
    <Loading className="py-20" isLoading={isInitialDataLoading}>
      <section className="bg-[#EFEFEF]">
        <div className="2xl-only max-w-full lg:container mx-auto">
          <div className="flex flex-wrap">
            <div className="w-full md:w-1/1 xl:w-1/2 lg:w-1/2">
              <div className="relative left-0 top-0 ">
                <img
                  className="object-cover w-full md:h-1/2"
                  src={
                    bundle?.variants?.nodes[
                      cartInfo[bundle.handle].variantIndex
                    ]?.image?.url
                  }
                  alt="FeastBox bundle"
                  onLoad={() => setIsInitialDataLoading(false)}
                />
              </div>
            </div>
            <div className="w-full md:w-1/1 lg:w-1/2 xl:w-1/2 px-8">
              <div className="">
                <div className="mt-2 font-bold">
                  <div className="lg:text-[60px] text-[36px]">
                    {bundle?.title}
                  </div>
                  {bundle.handle === 'family-feastbox' ? (
                    <div className="lg:flex lg:gap-2">
                      <div className="font-bold text-md">Feeding a party?</div>
                      <Link
                        className="font-bold text-md text-[#DB9707] underline"
                        to="/shop/bundle/event-feastbox"
                        reloadDocument
                      >
                        Try our Event Box
                      </Link>
                    </div>
                  ) : (
                    <div className="lg:flex lg:gap-2">
                      <div className="font-bold text-md">Too much food?</div>
                      <Link
                        className="font-bold text-md text-[#DB9707] underline"
                        to="/shop/bundle/family-feastbox"
                        reloadDocument
                      >
                        Choose our Family Box
                      </Link>
                    </div>
                  )}
                </div>
                <div className="mb-10 pb-10">
                  <div style={{padding: '20px 0'}}>
                    <div className="mb-6 bg-grey" style={{maxWidth: '100%'}}>
                      <div className="flex items-center gap-6 text-gray-800  mb-2">
                        <div className="md:text-2xl text-lg font-bold">
                          1. Choose your Week
                        </div>
                      </div>
                      <div
                        className="relative"
                        style={{boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)'}}
                      >
                        <select
                          className="addWeek removeWeek appearance-none block w-full py-4 pl-6 mb-2 text-md text-darkgray-400 bg-white"
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
                  </div>
                  {bundle.handle === 'event-feastbox' && (
                    <div style={{padding: '20px 0'}}>
                      <div className="mb-6 bg-grey" style={{maxWidth: '100%'}}>
                        <div className="flex items-center gap-6 text-gray-800  mb-2">
                          <div className="text-2xl font-bold">
                            2. Party Size?
                          </div>
                        </div>
                        <div
                          className="relative"
                          style={{boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)'}}
                        >
                          <select
                            className="appearance-none block w-full py-4 pl-6 mb-2 text-md text-darkgray-400 bg-white"
                            name="week"
                            onChange={handlePartyChange}
                            value={cartInfo[bundle.handle].variantIndex}
                            style={{borderWidth: 0, backgroundImage: 'none'}}
                          >
                            <option disabled value={-1}>
                              --Choose an option--
                            </option>
                            {bundle?.variants?.nodes?.map((index, key) => (
                              <option key={key} value={key}>
                                {index.metafields[0].value}
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
                    </div>
                  )}
                  <div className="mb-14">
                    <div className="flex items-center gap-6 text-gray-800  mb-2">
                      <div className="md:text-2xl text-lg font-bold">
                        {bundle.handle === 'event-feastbox' ? '3' : '2'}. Choose
                        your Meals
                      </div>
                      <div className="text-sm">
                        ({currentQuantity} of{' '}
                        {cartInfo[bundle.handle].mealQuantity})
                      </div>
                    </div>
                    <Loading isLoading={isProductsLoading}>
                      <div className="flex flex-wrap -mx-2 -mb-2">
                        {products.length ? (
                          products.map((product, key) => (
                            <div
                              key={key}
                              className="flex w-1/2 lg:w-1/5 sm:w-1/3 md:w-1/3 md:p-2 text-center mb-4"
                            >
                              <div className="flex flex-col justify-between text-center">
                                <MealItem
                                  title={
                                    product.variants.nodes[
                                      getVariantIndexDynamically()
                                    ].metafields?.find(
                                      (x) => x?.key === 'display_name',
                                    )?.value
                                  }
                                  image={
                                    product.featuredImage
                                      ? product.featuredImage.url
                                      : 'https://www.freeiconspng.com/uploads/no-image-icon-6.png'
                                  }
                                  modalimage={
                                    product.variants.nodes[
                                      getVariantIndexDynamically()
                                    ].image
                                      ? product.variants.nodes[
                                          getVariantIndexDynamically()
                                        ].image?.url
                                      : 'https://www.freeiconspng.com/uploads/no-image-icon-6.png'
                                  }
                                  metafields={
                                    product.variants.nodes[
                                      getVariantIndexDynamically()
                                    ].metafields
                                  }
                                  variant_title={
                                    bundle.handle === 'event-feastbox'
                                      ? product.variants.nodes[
                                          getVariantIndexDynamically()
                                        ].title.split('/ ')[1]
                                      : 'Serves 5'
                                  }
                                />

                                {cartInfo[bundle.handle].meals.findIndex(
                                  (el) =>
                                    el.variants.nodes[
                                      cartInfo[bundle.handle].variantIndex
                                    ].id ===
                                    product.variants.nodes[
                                      cartInfo[bundle.handle].variantIndex
                                    ].id,
                                ) === -1 ? (
                                  <div className="mt-2 px-4 text-center">
                                    <button
                                      className="addMeal w-full text-center text-white font-bold font-heading uppercase transition bg-[#DB9707] md:w-[80px] px-5 py-1 disabled:bg-[#bdac89]"
                                      onClick={() => handleUpdateCart(product)}
                                      disabled={isQuantityLimit}
                                    >
                                      Add+
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex mt-2 lg:justify-center font-semibold font-heading px-4">
                                    <button
                                      className="removeMeal hover:text-gray-700 text-center bg-[#DB9707] text-white"
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
                                    <div className="grow w-8 m-0 px-2 py-[2px] text-center border-0 focus:ring-transparent focus:outline-none bg-white text-gray-500">
                                      {
                                        cartInfo[bundle.handle].meals.find(
                                          (el) =>
                                            el.variants.nodes[
                                              cartInfo[bundle.handle]
                                                .variantIndex
                                            ].id ===
                                            product.variants.nodes[
                                              cartInfo[bundle.handle]
                                                .variantIndex
                                            ].id,
                                        ).quantity
                                      }
                                    </div>
                                    <button
                                      className="addMeal hover:text-gray-700 text-center bg-[#DB9707] text-white disabled:bg-[#bdac89]"
                                      onClick={() =>
                                        handleUpdateCart(product, 1)
                                      }
                                      disabled={isQuantityLimit}
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
                            <div>Choose your week above to see meals</div>
                          </div>
                        )}
                      </div>
                    </Loading>
                  </div>
                  <div className="container mx-auto px-4 mt-5">
                    {bundle.handle === 'family-feastbox' ? (
                      <div className="max-w-4xl mx-auto">
                        <div className="block text-gray-800 md:text-2xl text-lg font-bold mb-2 -ml-4">
                          3. Choose your Price
                        </div>
                        <div className="flex flex-wrap -mx-4">
                          <div
                            className={`lg:w-[50%] md:w-full sm-max:w-full px-2 ${
                              !isQuantityLimit ? 'opacity-50' : ''
                            }`}
                          >
                            <div
                              className={`relative ${
                                selectedGray === 2
                                  ? 'bg-[#F1F1F1]'
                                  : 'bg-gray-50'
                              }`}
                            >
                              <div
                                className="px-6 py-4 mt-8"
                                style={{
                                  boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)',
                                  border:
                                    selectedGray === 2
                                      ? ''
                                      : 'solid #DB9707 4px',
                                }}
                              >
                                {selectedGray === 2 ? (
                                  ''
                                ) : (
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
                                )}

                                {/*---radio---*/}
                                <div className="mb-1">
                                  <div
                                    className="mb-1"
                                    style={{color: '#000000'}}
                                  >
                                    <div className="flex flex-wrap -mx-4 -mb-4 md:mb-0">
                                      <div className="w-full px-4 mb-4 md:mb-0">
                                        {' '}
                                        <label>
                                          <input
                                            className="subscribeSave"
                                            id="subscribe_save"
                                            type="radio"
                                            name="price_type"
                                            value="recuring"
                                            defaultChecked={
                                              cartInfo[bundle.handle]
                                                .priceType === 'recuring'
                                            }
                                            onClick={(e) => {
                                              setCartInfo({
                                                ...cartInfo,
                                                [bundle.handle]: {
                                                  ...cartInfo[bundle.handle],
                                                  priceType: e.target.value,
                                                },
                                              });
                                              handleSelectGray(1);
                                              window.dataLayer.push({
                                                event: 'subscribeSave',
                                              });
                                            }}
                                          />
                                          <span
                                            className={`ml-3 font-bold ${
                                              selectedGray === 2
                                                ? 'text-[#BAB9B9]'
                                                : ''
                                            }`}
                                            style={{fontSize: 18}}
                                          >
                                            SUBSCRIBE &amp; SAVE
                                          </span>
                                          <br />
                                          <div style={{paddingBottom: 14}}>
                                            <span className="mr-2">
                                              <strike
                                                className={`${
                                                  selectedGray === 2
                                                    ? 'text-[#BAB9B9]'
                                                    : ''
                                                }`}
                                              >
                                                {getFullCost(
                                                  typeof bundle?.variants
                                                    ?.nodes[
                                                    cartInfo[bundle.handle]
                                                      .variantIndex
                                                  ]?.priceV2?.amount !==
                                                    'undefined'
                                                    ? bundle?.variants?.nodes[
                                                        cartInfo[bundle.handle]
                                                          .variantIndex
                                                      ]?.priceV2?.amount
                                                    : undefined,
                                                  bundle?.variants?.nodes[
                                                    cartInfo[bundle.handle]
                                                      .variantIndex
                                                  ]?.priceV2?.currencyCode,
                                                )}
                                              </strike>
                                            </span>
                                            <span
                                              className={`font-bold ${
                                                selectedGray === 2
                                                  ? 'text-[#BAB9B9]'
                                                  : ''
                                              }`}
                                              style={{fontSize: 18}}
                                            >
                                              {(() => {
                                                const price =
                                                  bundle?.variants?.nodes[
                                                    cartInfo[bundle.handle]
                                                      .variantIndex
                                                  ]?.priceV2?.amount;
                                                const adjustmentPercentage =
                                                  bundle?.sellingPlanGroups
                                                    ?.nodes[0]?.sellingPlans
                                                    ?.nodes[0]
                                                    ?.priceAdjustments[0]
                                                    ?.adjustmentValue
                                                    ?.adjustmentPercentage;

                                                if (
                                                  typeof adjustmentPercentage !==
                                                  'undefined'
                                                )
                                                  return getFullCost(
                                                    (
                                                      price -
                                                      (price *
                                                        adjustmentPercentage) /
                                                        100
                                                    ).toFixed(6),
                                                    bundle?.variants?.nodes[
                                                      cartInfo[bundle.handle]
                                                        .variantIndex
                                                    ]?.priceV2?.currencyCode,
                                                  );

                                                return '';
                                              })()}
                                              /{' '}
                                            </span>
                                            <span
                                              className={`${
                                                selectedGray === 2
                                                  ? 'text-[#BAB9B9]'
                                                  : ''
                                              }`}
                                            >
                                              {cartInfo[bundle.handle]
                                                .mealQuantity +
                                                ' Family Meals + 1 Free breakfast'}
                                            </span>
                                          </div>
                                        </label>
                                      </div>
                                    </div>
                                    <hr />
                                    <p
                                      style={{marginTop: 10}}
                                      className={`${
                                        selectedGray === 2
                                          ? 'text-[#BAB9B9]'
                                          : 'text-[#DB9725]'
                                      }`}
                                    >
                                      <span
                                        style={{fontSize: 18}}
                                        className={`font-bold ${
                                          selectedGray === 2
                                            ? 'text-[#BAB9B9]'
                                            : ''
                                        }`}
                                      >
                                        Limited Time Promotion:
                                      </span>{' '}
                                      <br />
                                      Get a FREE Breakfast with the life of your
                                      Subscription. (A $60.00 value)
                                    </p>
                                    <br />
                                    <p
                                      className={`${
                                        selectedGray === 2
                                          ? 'text-[#BAB9B9]'
                                          : ''
                                      }`}
                                    >
                                      Delivery Every:{' '}
                                      <button
                                        className={
                                          cartInfo[bundle.handle]
                                            .frequencyValue === '7 Day(s)'
                                            ? `Weekly text-[#DB9725]`
                                            : `biWeekly text-[#DB9725]`
                                        }
                                        style={{
                                          color:
                                            selectedGray === 2
                                              ? '#BAB9B9'
                                              : '#DB9725',
                                        }}
                                        onClick={handleToggleFrequency}
                                        disabled={!isQuantityLimit}
                                      >
                                        <u>
                                          {' '}
                                          {cartInfo[bundle.handle]
                                            .frequencyValue === '7 Day(s)'
                                            ? 'Weekly'
                                            : 'Biweekly'}
                                        </u>{' '}
                                        &gt;{' '}
                                      </button>
                                    </p>
                                    <p
                                      className={`${
                                        selectedGray === 2
                                          ? 'text-[#BAB9B9]'
                                          : ''
                                      }`}
                                    >
                                      {(() => {
                                        const price =
                                          bundle?.variants?.nodes[
                                            cartInfo[bundle.handle].variantIndex
                                          ]?.priceV2?.amount;
                                        const adjustmentPercentage =
                                          bundle?.sellingPlanGroups?.nodes[0]
                                            ?.sellingPlans?.nodes[0]
                                            ?.priceAdjustments[0]
                                            ?.adjustmentValue
                                            ?.adjustmentPercentage;

                                        if (
                                          typeof adjustmentPercentage !==
                                          'undefined'
                                        ) {
                                          const diff =
                                            (price * adjustmentPercentage) /
                                            100;

                                          return (
                                            'Save ' +
                                            getFullCost(
                                              diff,
                                              bundle?.variants?.nodes[
                                                cartInfo[bundle.handle]
                                                  .variantIndex
                                              ]?.priceV2?.currencyCode,
                                            )
                                          );
                                        }
                                        return '';
                                      })()}
                                    </p>
                                    <p
                                      className={`${
                                        selectedGray === 2
                                          ? 'text-[#BAB9B9]'
                                          : ''
                                      }`}
                                    >
                                      No Commitments, Cancel Anytime
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            className={`lg:w-[50%] md:w-full sm-max:w-full px-2 ${
                              !isQuantityLimit ? 'opacity-50' : ''
                            }`}
                          >
                            <div
                              className={`relative ${
                                selectedGray === 1
                                  ? 'bg-[#F1F1F1]'
                                  : 'bg-gray-50'
                              }`}
                            >
                              <div
                                className="px-6 py-4 mt-8"
                                style={{
                                  boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)',
                                  border:
                                    selectedGray === 1
                                      ? ''
                                      : 'solid #DB9707 4px',
                                }}
                              >
                                <div className="mb-1">
                                  <div
                                    className="mb-1"
                                    style={{color: '#000000'}}
                                  >
                                    <div className="flex flex-wrap -mx-4 -mb-4 md:mb-0">
                                      <div className="w-full px-4 mb-4 md:mb-0">
                                        {' '}
                                        <label>
                                          <input
                                            className="oneTime"
                                            id="one-time"
                                            type="radio"
                                            name="price_type"
                                            value="onetime"
                                            defaultChecked={
                                              cartInfo[bundle.handle]
                                                .priceType === 'onetime'
                                            }
                                            onClick={(e) => {
                                              setCartInfo({
                                                ...cartInfo,
                                                [bundle.handle]: {
                                                  ...cartInfo[bundle.handle],
                                                  priceType: e.target.value,
                                                },
                                              });
                                              handleSelectGray(2);
                                              window.dataLayer.push({
                                                event: 'oneTime',
                                              });
                                            }}
                                          />
                                          <span
                                            className={`ml-3 font-bold ${
                                              selectedGray === 1
                                                ? 'text-[#BAB9B9]'
                                                : ''
                                            }`}
                                            style={{fontSize: 18}}
                                          >
                                            ONE-TIME
                                          </span>
                                          <br />

                                          {newDiscountCodes.length > 0 ? (
                                            <span className="mr-2">
                                              <strike
                                                className={`${
                                                  selectedGray === 1
                                                    ? 'text-[#BAB9B9]'
                                                    : ''
                                                }`}
                                              >
                                                {getFullCost(
                                                  bundle?.variants?.nodes[
                                                    cartInfo[bundle.handle]
                                                      .variantIndex
                                                  ]?.priceV2?.amount,
                                                  bundle?.variants?.nodes[
                                                    cartInfo[bundle.handle]
                                                      .variantIndex
                                                  ]?.priceV2?.currencyCode,
                                                )}{' '}
                                              </strike>
                                            </span>
                                          ) : (
                                            ''
                                          )}
                                          <span
                                            className={`font-bold ${
                                              selectedGray === 1
                                                ? 'text-[#BAB9B9]'
                                                : ''
                                            }`}
                                            style={{fontSize: 18}}
                                          >
                                            {getFullCost(
                                              bundle?.variants?.nodes[
                                                cartInfo[bundle.handle]
                                                  .variantIndex
                                              ]?.priceV2?.amount -
                                                identifyDiscountAmount(),
                                              bundle?.variants?.nodes[
                                                cartInfo[bundle.handle]
                                                  .variantIndex
                                              ]?.priceV2?.currencyCode,
                                            )}{' '}
                                            /{' '}
                                          </span>
                                          <span
                                            className={`${
                                              selectedGray === 1
                                                ? 'text-[#BAB9B9]'
                                                : ''
                                            }`}
                                          >
                                            3 Family Meals
                                          </span>
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p style={{color: '#DB9725', marginTop: 10}}>
                              <span
                                style={{fontSize: 18}}
                                className=" font-bold"
                              >
                                Discount Coupon:
                              </span>
                              <br />
                            </p>
                            <div className="flex items-center gap-4 py-4">
                              <div className="grow">
                                <input
                                  ref={discountCodeInputRef}
                                  className="w-full py-3 px-4 border-[#707070] focus:bg-white border focus:outline-none"
                                  defaultValue={newDiscountCodes.join(' ')}
                                  disabled={newDiscountCodes.length > 0}
                                  onChange={() =>
                                    setErrors({...errors, discountCode: ''})
                                  }
                                />
                              </div>
                              <div className="flex-none flex items-center">
                                {newDiscountCodes.length === 0 &&
                                  errors.discountCode === '' && (
                                    <button
                                      className="addCoupon removeCoupon failedCoupon inline-block py-3 px-6 text-white shadow bg-[#DB9707] p-[30px]"
                                      onClick={handleSubmitDiscountCode}
                                    >
                                      Apply
                                    </button>
                                  )}
                                {newDiscountCodes.length > 0 && (
                                  <div className="text-lg font-bold text-[#DB9707]">
                                    Code Applied
                                  </div>
                                )}
                                {errors.discountCode !== '' && (
                                  <div className="text-lg font-bold text-red-500">
                                    {errors.discountCode}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="text-gray-700 text-sm font-bold">
                                *Shipping and discounts calculated at checkout.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p style={{color: '#DB9725', marginTop: 10}}>
                          <span style={{fontSize: 18}} className=" font-bold">
                            Discount Coupon:
                          </span>
                          <br />
                        </p>
                        <div className="flex items-center gap-4 py-4">
                          <div className="grow">
                            <input
                              ref={discountCodeInputRef}
                              className="w-full py-3 px-4 border-[#707070] focus:bg-white border focus:outline-none"
                              defaultValue={newDiscountCodes.join(' ')}
                              disabled={newDiscountCodes.length > 0}
                            />
                          </div>
                          <div className="flex-none flex items-center">
                            {newDiscountCodes.length === 0 && (
                              <button
                                className="inline-block py-3 px-6 text-white shadow bg-[#DB9707] p-[30px]"
                                onClick={handleSubmitDiscountCode}
                              >
                                Apply
                              </button>
                            )}
                            {newDiscountCodes.length > 0 && (
                              <div className="text-lg font-bold text-[#DB9707]">
                                Code Applied
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-gray-700 text-sm font-bold">
                            *Shipping and discounts calculated at checkout.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-2 mt-10 text-center sm:text-left">
                      <div className="text-left pb-2">
                        <span className="font-bold md:text-[28px] text-lg mb-1">
                          Total:{' '}
                          {bundle.handle === 'event-feastbox' ? (
                            <>
                              <span className="mr-2">
                                {newDiscountCodes.length > 0 ? (
                                  <strike>
                                    {getFullCost(
                                      totalPrice,
                                      bundle.variants?.nodes[
                                        cartInfo[bundle.handle]?.variantIndex
                                      ]?.priceV2?.currencyCode,
                                    )}
                                  </strike>
                                ) : (
                                  ''
                                )}
                              </span>
                              <span>
                                {getFullCost(
                                  parseFloat(
                                    totalPrice - identifyDiscountAmount(),
                                  ),
                                  bundle.variants?.nodes[
                                    cartInfo[bundle.handle]?.variantIndex
                                  ]?.priceV2?.currencyCode,
                                )}
                              </span>
                            </>
                          ) : cartInfo[bundle.handle]?.priceType ===
                            'recuring' ? (
                            <>
                              <span className="mr-2">
                                <strike>
                                  {getFullCost(
                                    typeof bundle?.variants?.nodes[
                                      cartInfo[bundle.handle].variantIndex
                                    ]?.priceV2?.amount !== 'undefined'
                                      ? bundle?.variants?.nodes[
                                          cartInfo[bundle.handle].variantIndex
                                        ]?.priceV2?.amount
                                      : undefined,
                                    bundle?.variants?.nodes[
                                      cartInfo[bundle.handle].variantIndex
                                    ]?.priceV2?.currencyCode,
                                  )}
                                </strike>
                              </span>
                              <span>
                                {getFullCost(
                                  parseFloat(totalPrice),
                                  bundle.variants?.nodes[
                                    cartInfo[bundle.handle]?.variantIndex
                                  ]?.priceV2?.currencyCode,
                                )}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="mr-2">
                                {newDiscountCodes.length > 0 ? (
                                  <strike>
                                    {getFullCost(
                                      totalPrice,
                                      bundle.variants?.nodes[
                                        cartInfo[bundle.handle]?.variantIndex
                                      ]?.priceV2?.currencyCode,
                                    )}
                                  </strike>
                                ) : (
                                  ''
                                )}
                              </span>
                              <span>
                                {getFullCost(
                                  parseFloat(
                                    totalPrice - identifyDiscountAmount(),
                                  ),
                                  bundle.variants?.nodes[
                                    cartInfo[bundle.handle]?.variantIndex
                                  ]?.priceV2?.currencyCode,
                                )}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <button
                          disabled={!isQuantityLimit || isCheckoutProcessing}
                          className={`checkout flex justify-center md:w-[264px] w-full py-5 text-lg text-white text-center bg-[#DB9707] disabled:bg-[#D8D8D8] uppercase font-bold`}
                          onClick={handleCheckout}
                        >
                          {isCheckoutProcessing ? (
                            <Spinner />
                          ) : (
                            <>
                              {isQuantityLimit
                                ? 'CHECKOUT'
                                : 'ADD MEALS TO CONTINUE'}
                            </>
                          )}
                        </button>
                        <p className="text-sm bg-[#EFEFEF]">
                          Delivery Day:{' '}
                          <strong>
                            {cartInfo[bundle.handle].deliveryDate
                              ? getUsaStandard(
                                  cartInfo[bundle.handle].deliveryDate,
                                )
                              : '---- -- --'}
                          </strong>
                          <br />
                          <span
                            onClick={() =>
                              setIsDeliveryDateEditing(!isDeliveryDateEditing)
                            }
                            className="text-[#DB9707] cursor-pointer changeDeliveryDay"
                          >
                            <u>Change Delivery Day</u>
                          </span>
                        </p>
                      </div>
                      <p
                        onClick={() => setShowMoneyBackModal(true)}
                        className="text-gray-700 text-sm font-bold underline cursor-pointer"
                      >
                        *100% Money-Back Guarantee
                      </p>
                    </div>
                    {showMoneyBackModal && (
                      <MoneyBackModal
                        setOpenModal={(showMoneyBackModal) =>
                          setShowMoneyBackModal(showMoneyBackModal)
                        }
                      />
                    )}
                    <div>
                      {isDeliveryDateEditing && availableSlots.length > 0 && (
                        <div
                          className="bg-white mt-4"
                          style={{
                            boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)',
                          }}
                        >
                          <div className="mb-1">
                            <div className="mb-1" style={{color: '#000000'}}>
                              <div className="flex flex-wrap -mx-4 -mb-4 md:mb-0 p-2">
                                {availableSlots.map((slot, key) => (
                                  <div
                                    key={key}
                                    className="w-full md:w-1/2 px-4 mb-4 md:mb-0"
                                  >
                                    <label>
                                      <input
                                        type="radio"
                                        name="radio-name"
                                        value="option 1"
                                        checked={
                                          cartInfo[bundle.handle]
                                            .deliveryDate === slot.date
                                        }
                                        onClick={() => {
                                          setCartInfo({
                                            ...cartInfo,
                                            [bundle.handle]: {
                                              ...cartInfo[bundle.handle],
                                              deliveryDate: slot.date,
                                            },
                                            deliveryDate: slot.date,
                                          });
                                          setIsDeliveryDateEditing(false);

                                          window.dataLayer.push({
                                            event: 'changeDeliveryDay',
                                            value: slot.date,
                                          });
                                        }}
                                      />
                                      <span className="ml-3 font-bold">
                                        {dayjs(slot.date).format('ddd, MMM DD')}{' '}
                                      </span>
                                      <br />
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Loading>
  );
}
