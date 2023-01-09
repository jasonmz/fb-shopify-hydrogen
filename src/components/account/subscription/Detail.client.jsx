import {Image, useNavigate, Link, fetchSync, useCart} from '@shopify/hydrogen';
import {useState, useEffect, useRef} from 'react';
import axios from 'axios';
import {useForm} from 'react-hook-form';
import {
  dayjs,
  findWeekDayBetween,
  getCutOffDate,
  getTodayDate,
  getUsaStandard,
  sortByDateProperty,
  uniqueArray,
  sortDatesArray,
  sortObjectKeys,
  addDays,
} from '~/utils/dates';
import {encryptSubId, decryptSubId} from '~/utils/common';
import {
  getOrderTrackingUrl,
  buildProductArrayFromVariant,
  buildProductArrayFromId,
} from '~/utils/products';
import {MealItem} from '~/components/shopping/MealItem.client';
import Loading from '~/components/Loading/index.client';

const Index = ({subscription, subscription_id, user}) => {
  // console.log('subscription===', user);
  const TOTAL_WEEKS_DISPLAY = 4;
  const TOTAL_WEEKS_PER_PAGE = 1;
  const STATUS_LOCKED = 'locked';
  const STATUS_PENDING = 'pending';
  const STATUS_SENT = 'sent';

  const navigate = useNavigate();
  const [processOrder, setProcessOrder] = useState(false);
  const [processSkip, setProcessSkip] = useState(false);
  const [processCancel, setProcessCancel] = useState(false);
  const [processReactivate, setProcessReactivate] = useState(false);

  const [activeMeals, setActiveMeals] = useState([]);
  const [weeksMenu, setWeeksMenu] = useState([]);
  const [activeWeekDateIndex, setActiveWeekDateIndex] = useState(-1);
  const [isMealSelectionLoading, setIsMealSelectionLoading] = useState(false);
  const [isProductsLoading, setIsProductsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: {errors},
    setValue,
  } = useForm({
    defaultValues: {
      order_interval_frequency: subscription.order_interval_frequency,
      order_interval_unit: subscription.order_interval_unit,
    },
  });
  const onSubmit = async (data) => {
    await axios.post(`/api/account/subscriptions/update`, {
      id: subscription.id,
      data,
    });
    alert('The subscription info is updated.');
  };

  const [isChanging, setIsChanging] = useState(true);
  const [changedDeliveryDate, setChangedDeliveryDate] = useState(false);
  const [next_charge_scheduled_at, setNext_charge_scheduled_at] = useState(
    subscription.next_charge_scheduled_at,
  );

  const handleOrderNow = async () => {
    setProcessOrder(true);
    await axios.post(`/api/account/orders/create`, {
      customer_id: subscription.customer_id,
    });
    setProcessOrder(false);
  };

  const handleSkipThisOrder = async () => {
    setProcessSkip(true);
    await axios.post(`/api/account/orders/skipUpcomingOrder`, {
      customer_id: subscription.customer_id,
    });
    setProcessSkip(false);
    alert('The next order is skipped.');
    navigate('/account/subscriptions', {replace: true, reloadDocument: true});
  };

  const handleReactiveSubscription = async () => {
    setProcessReactivate(true);
    await axios.patch(`/api/account/subscriptions/${subscription.id}`);
    setProcessReactivate(false);
  };

  const handleSaveDeliveryDate = async () => {
    await axios.post(`/api/account/subscriptions/updateNextDeliveryDate`, {
      id: subscription.id,
      date: next_charge_scheduled_at,
    });
    setChangedDeliveryDate(false);
  };

  // Functions for Edit meal plan
  const createWeekList = (weeksMenu, deliverAfterDate) => {
    if (!weeksMenu.includes(dayjs(deliverAfterDate).format('YYYY-MM-DD'))) {
      weeksMenu.push(dayjs.utc(deliverAfterDate).format('YYYY-MM-DD'));
    }

    return weeksMenu;
  };

  useEffect(() => {
    const getData = async (subscription_id) => {
      setIsMealSelectionLoading(true);
      // const userToken = await getToken()
      // await clearState()
      // set customer email to session so that we can use it in apis call
      await axios.post(`/api/bundleAuth/setSession`, {
        email: user.email,
      });
      await getOrdersToShow(subscription_id);
      // dispatch(setEmail(shopCustomer?.email || ''))
      // const onSubmit = async (data) => {
      //     await axios.post(`/api/account/subscriptions/update`, {
      //       id: subscription.id,
      //       data,
      //     });
      //     alert('The subscription info is updated.');
      //   };
      setIsMealSelectionLoading(false);
    };
    getData(subscription_id);
  }, []);

  // get subscription lists
  const getOrdersToShow = async (subscription_id) => {
    console.log('----getOrdersToShow----');
    // const todayDate = formatTodayDate(new Date());
    const todayDate = getTodayDate();
    const weeksMenu = [];
    //get subscription data
    const subResponse = await axios.get(
      `/api/bundleAuth/subscriptions?is_active=1&platform_subscription_id=${subscription_id}`,
    );
    let subApi = subResponse.data;
    console.log('subApi', subApi);

    // var firstOrderDeliveryDate = todayDate;
    // console.log('----subApi----', subApi)
    if (subApi) {
      for (const sub of subApi) {
        const subscriptionOrdersResponse = await axios.get(
          `/api/bundleAuth/subscriptions/${sub.id}/orders`,
        );
        const subscriptionOrders = subscriptionOrdersResponse.data;
        console.log('----sub----', sub);
        console.log('----subscriptionOrders----', subscriptionOrders);

        const configDataResponse = await axios.get(
          `/api/bundleAuth/bundles/${sub.bundle_id}/configurations`,
        );
        const configData = configDataResponse.data;
        console.log('----configData----', configData);
        console.log('----USERDATA----', user);

        if (configData.length > 0) {
          for (const config of configData) {
            for (const content of config.contents) {
              // find delivery date between range
              const deliveryDate = findWeekDayBetween(
                sub.delivery_day,
                content.deliver_after,
                content.deliver_before,
              );
              const cutoffDate = getCutOffDate(deliveryDate);
              const firstOrder = user.orders?.edges?.pop() || null;

              const firstOrderDate =
                (firstOrder && dayjs(firstOrder.node.processedAt).utc()) ||
                dayjs().utc();
              // validates the first order to avoid displaying the week where the order was placed (always show next week)
              console.log('firstOrderDate', firstOrderDate);
              // console.log('firstOrderDeliveryDate', firstOrderDeliveryDate);
              if (
                dayjs(content.deliver_before).utc().isSameOrAfter(todayDate) &&
                firstOrderDate.isSameOrBefore(content.deliver_after)
              ) {
                // console.log('subscriptionOrders', subscriptionOrders);
                console.log('content', content);
                const orderedItems = subscriptionOrders.filter(
                  (ord) =>
                    ord.bundle_configuration_content.deliver_after ===
                    content.deliver_after,
                );
                // console.log('orderedItems', orderedItems);

                if (orderedItems.length > 0) {
                  const orderFound = orderedItems[0];
                  let thisItemsArray = [];
                  for (const order of orderedItems) {
                    thisItemsArray = thisItemsArray.concat(order.items);
                  }

                  let weekMenuData = [];
                  weekMenuData['subscriptionDate'] = dayjs
                    .utc(content.deliver_after)
                    .format('YYYY-MM-DD');
                  weekMenuData['bundle_configuration_id'] =
                    content.bundle_configuration_id;
                  weekMenuData['content_id'] = content.id;
                  weekMenuData['bundle_id'] = config.bundle_id;
                  weekMenuData['config_quantity'] = config.quantity;
                  weekMenuData['delivery_day'] = sub.delivery_day;
                  weekMenuData['sub_id'] = sub.id;
                  weekMenuData['subscription_type'] = sub.subscription_type;
                  weekMenuData['subscription_sub_type'] =
                    sub.subscription_sub_type;
                  //edit order
                  weekMenuData['queryDate'] = content.deliver_after;
                  weekMenuData['orderedItems'] = thisItemsArray;
                  weekMenuData['status'] =
                    orderFound.platform_order_id !== null
                      ? STATUS_SENT
                      : todayDate.isSameOrAfter(cutoffDate)
                      ? STATUS_LOCKED
                      : STATUS_PENDING;
                  weeksMenu.push(weekMenuData);
                  /*if (orderFound.platform_order_id !== null) {
                    subscriptionArray[subscriptionObjKey].trackingUrl =
                      await getOrderTrackingUrl(
                        orderFound.platform_order_id,
                        user,
                      );
                    }*/

                } else {
                  // if there is no saved or ordered item found.
                  let weekMenuData = [];
                  weekMenuData['subscriptionDate'] = dayjs
                    .utc(content.deliver_after)
                    .format('YYYY-MM-DD');
                  weekMenuData['bundle_configuration_id'] =
                    content.bundle_configuration_id;
                  weekMenuData['content_id'] = content.id;
                  weekMenuData['bundle_id'] = config.bundle_id;
                  weekMenuData['config_quantity'] = config.quantity;
                  weekMenuData['delivery_day'] = sub.delivery_day;
                  weekMenuData['sub_id'] = sub.id;
                  weekMenuData['subscription_type'] = sub.subscription_type;
                  weekMenuData['subscription_sub_type'] =
                    sub.subscription_sub_type;
                  //edit order
                  weekMenuData['queryDate'] = content.deliver_after;
                  weekMenuData['orderedItems'] = [];
                  weekMenuData['status'] = todayDate.isSameOrAfter(cutoffDate)
                    ? STATUS_LOCKED
                    : STATUS_PENDING;
                  weeksMenu.push(weekMenuData);
                } // end orderItemCondition
                //subCount++;
              }
            }
          }
        }
      }
    }

    const sortedWeekMenu = sortByDateProperty(weeksMenu, 'subscriptionDate');
    setWeeksMenu(sortedWeekMenu);
    console.log('weeksMenuweeksMenuweeksMenuweeksMenu', weeksMenu);
  };

  async function handleWeekChange(e) {
    setIsProductsLoading(true);
    const newWeekDateIndex = e.target.value;
    setActiveWeekDateIndex(newWeekDateIndex);
    const activeWeekData = weeksMenu[newWeekDateIndex];
    console.log('activeWeekDataactiveWeekDataactiveWeekData', activeWeekData);

    if (activeWeekData.orderedItems.length > 0){

    }else{
      const defaultProductsResponse = await axios.get(
        `/api/bundleAuth/bundles/${activeWeekData.bundle_id}/configurations/${activeWeekData.bundle_configuration_id}/contents/${activeWeekData.content_id}/products?is_default=1`,
      );
      const defaultProducts = defaultProductsResponse.data;
      console.log('defaultProducts', defaultProducts);
      if (defaultProducts) {
        let product_ids = [];
        defaultProducts.map((el) => {
          product_ids.push(el.platform_product_id);
        });
        if (product_ids.length) {
          const {data: products} = await axios.post(`/api/products/multiple`, {
            product_ids,
          });
          console.log('productsproducts', products);
          const thisProductsArray = await buildProductArrayFromId(
            defaultProducts,
            activeWeekData.subscription_sub_type,
            products,
          );
          console.log('thisProductsArray', thisProductsArray);
          // setActiveMeals(selectedSub);
          let activeMealsData = [];
          activeMealsData[0] = activeWeekData;
          activeMealsData[0]['items'] = thisProductsArray;
          console.log('activeMealsDataactiveMealsData', activeMealsData);
          setActiveMeals(activeMealsData);
        }
      }
    }
    setIsProductsLoading(false);
  }
  return (
    <Loading isLoading={isMealSelectionLoading}>
      <div className="flex flex-wrap -m-4">
        <div className="w-full flex justify-between mb-4 text-3xl uppercase font-bold">
          EDIT YOUR SUBSCRIPTION ({subscription_id})
        </div>
        <div className="w-full">
          {/*-------Subscription box--------------------------*/}
          <div className="container px-5 mx-auto subscription_box">
            <div className="flex flex-wrap -mb-0">
              <div className="w-full md:w-1/1 xl:w-3/3 lg:w-3/3">
                <div className="mb-10 pb-10">
                  <div style={{backgroundColor: '#EFEFEF', padding: '20px 0'}}>
                    <div className="mb-6 bg-grey" style={{maxWidth: '100%'}}>
                      <div
                        className="block text-gray-800 text-lg font-bold mb-2"
                        style={{fontSize: 24}}
                      >
                        Choose your Week
                      </div>
                      <div
                        className="relative"
                        style={{boxShadow: '0 3px 10px rgb(0 0 0 / 0.2)'}}
                      >
                        <select
                          className="appearance-none block w-full py-4 pl-6 mb-2 text-md text-darkgray-400 bg-white"
                          name="week"
                          onChange={handleWeekChange}
                          value={activeWeekDateIndex}
                          style={{borderWidth: 0, backgroundImage: 'none'}}
                        >
                          <option disabled value={-1}>
                            --Choose an option--
                          </option>
                          {weeksMenu.map((week, key) => (
                            <option key={key} value={key}>
                              {getUsaStandard(week.subscriptionDate)} -{' '}
                              {getUsaStandard(
                                addDays(week.subscriptionDate, 6),
                              )}
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
                  {/* Choose meal Start */}
                  <Loading isLoading={isProductsLoading}>
                    <div className="flex flex-wrap -mx-2 -mb-2">
                      {activeMeals.length > 0 ? (
                        activeMeals.map((mealItem, key) => (
                          <div key={key} className="mealSelection">
                            <div className="flex justify-between">
                              <div
                                className="block text-gray-800 text-lg font-bold mb-2"
                                style={{fontSize: 24, marginTop: 20}}
                              >
                                Choose your Meals (
                                {getUsaStandard(mealItem.subscriptionDate)} -{' '}
                                {getUsaStandard(addDays(mealItem.subscriptionDate, 6))}
                                )
                              </div>
                              <div className="text-xl font-medium mt-[19px]">
                                <Link
                                  to={`/account/subscriptions/${subscription.id}/edit-order/${encryptSubId(mealItem.sub_id)}?date=${mealItem.queryDate}`}
                                >
                                  <button className="bg-[#DB9707] px-3 py-1 rounded-sm text-white text-sm">
                                    Edit Order
                                  </button>
                                </Link>
                              </div>
                            </div>
                            <div className="flex flex-wrap -mx-2 -mb-2">
                              {mealItem.items.length ? (
                                mealItem.items.map((product, key) => (
                                  <div
                                    key={key}
                                    className="flex w-1/2 lg:w-1/5 sm:w-1/3 md:w-1/3 md:p-2 text-center mb-4"
                                  >
                                    <div className="flex flex-col justify-between text-center">
                                      <MealItem
                                        title={product.title}
                                        image={
                                          product.feature_image
                                            ? product.feature_image
                                            : 'https://www.freeiconspng.com/uploads/no-image-icon-6.png'
                                        }
                                        modalimage={
                                          product.variant_image
                                            ? product.variant_image
                                            : 'https://www.freeiconspng.com/uploads/no-image-icon-6.png'
                                        }
                                        metafields={product.metafields}
                                        variant_title={
                                          product.type.toLowerCase() === 'family'
                                            ? 'Serves 5'
                                            : product.type
                                        }
                                      />
                                      <div className="text-sm font-bold">Quantity: {product.quantity}</div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="w-full flex justify-center items-center py-8 text-lg">
                                  <h2>No items to choose</h2>
                                  <p>Please come back soon to choose your menu items.</p>
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
                  {/* Choose meal End */}
                </div>
              </div>
            </div>
            {/*-------End Subscription Box--------------------------*/}
            <div className="flex flex-wrap -mb-0">
              <form onSubmit={handleSubmit(onSubmit)} className="w-full">
                <div className="mb-10">
                  <hr style={{margin: '20px 0'}} />
                  <div className="py-3">
                    <div className="flex justify-between">
                      <span className="font-bold text-lg font-medium">
                        Next Delivery:
                      </span>
                      <span className="font-bold font-heading">
                        {getUsaStandard(subscription.next_charge_scheduled_at)}
                      </span>
                    </div>
                  </div>
                  <hr style={{margin: '20px 0'}} />
                  <div className="py-3">
                    <div className="flex justify-between">
                      <span className="font-bold font-medium text-lg">
                        Frequency:
                      </span>
                      <span className="font-bold font-heading px-2">
                        <div className="flex flex-wrap">
                          <div className="text-right">
                            <div>
                              <div className="radio-buttons">
                                {subscription.product.subscription_defaults.order_interval_frequency_options.map(
                                  (frequency, key) => (
                                    <button
                                      type="button"
                                      key={key}
                                      className="radio-button relative cursor-pointer"
                                      onClick={() => {
                                        setValue(
                                          'order_interval_frequency',
                                          Number(frequency),
                                        );
                                      }}
                                    >
                                      <div className="font-bold flex items-center">
                                        {frequency}
                                        <span className="radio-button__label hide-mobile">
                                          Days
                                        </span>
                                        <span
                                          className="radio-button__check"
                                          style={{
                                            visibility: 'visible !important',
                                          }}
                                        >
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="19.52"
                                            height="14.56"
                                          >
                                            {watch(
                                              'order_interval_frequency',
                                            ) === Number(frequency) && (
                                              <path
                                                data-name="Icon awesome-check"
                                                d="M6.63 14.28.3 7.93a.98.98 0 0 1 0-1.38l1.38-1.38a.98.98 0 0 1 1.38 0l4.27 4.27L16.48.3a.98.98 0 0 1 1.38 0l1.38 1.38a.98.98 0 0 1 0 1.38L8.01 14.27a.98.98 0 0 1-1.38 0Z"
                                                fill="#5a3b36"
                                              />
                                            )}
                                          </svg>
                                        </span>
                                      </div>
                                    </button>
                                  ),
                                )}
                              </div>
                              <input
                                type="hidden"
                                name="order_interval_unit"
                                defaultValue="day"
                              />
                              <input
                                type="hidden"
                                name="order_interval_frequency"
                                defaultValue={14}
                              />
                            </div>
                          </div>
                          <span className="text-sm">
                            (Choose how often you want your order to be placed)
                          </span>
                        </div>
                      </span>
                    </div>
                  </div>
                  <hr style={{margin: '20px 0'}} />
                  <div className="py-3">
                    <div className="flex justify-between">
                      <span className="font-bold text-base md:text-xl font-bold font-heading">
                        Shipping Address
                      </span>
                      <span className="font-heading text-xl">
                        <Link
                          to={`/account/billing-account/shipping-address/${subscription.address_id}`}
                          className="font-bold underline"
                          style={{
                            fontSize: 14,
                            float: 'right',
                            color: '#DB9707',
                          }}
                        >
                          Edit
                        </Link>
                        <br />
                        <br />
                        {subscription.address.first_name}{' '}
                        {subscription.address.last_name}
                        <br />
                        {subscription.address.address1}
                        <br />
                        {subscription.address.address2}
                        <br />
                      </span>
                    </div>
                    <hr style={{margin: '20px 0'}} />
                    <div
                      className="flex justify-between"
                      style={{margin: '40px 0'}}
                    >
                      <div className="flex items-end">
                        {isChanging && (
                          <input
                            type="submit"
                            className="underline cursor-pointer font-bold"
                            style={{
                              fontSize: 14,
                              float: 'right',
                              color: '#DB9707',
                            }}
                            value="Save Changes"
                          />
                        )}
                      </div>
                      <div>
                        <button
                          className="font-bold underline"
                          style={{
                            fontSize: 14,
                            float: 'right',
                            color: '#DB9707',
                          }}
                          disabled={processSkip}
                          onClick={handleSkipThisOrder}
                        >
                          Skip Next Order
                        </button>
                        <br />
                        <Link
                          className="font-bold underline"
                          style={{
                            fontSize: 14,
                            float: 'right',
                            color: '#DB9707',
                          }}
                          disabled={processCancel}
                          to={`/account/subscriptions/${subscription.id}/cancel`}
                        >
                          Cancel Subscription
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Loading>
  );
};

export default Index;
