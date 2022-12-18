import {Image, useNavigate, Link} from '@shopify/hydrogen';
import {useState, useEffect} from 'react';
import axios from 'axios';
import {getUsaStandard} from '~/utils/dates';
import Moment from 'moment';

const Index = ({orders, external_customer_id}) => {
  const [checked, setChecked] = useState(true);
  const [currentCheck, setCurrentCheck] = useState(0);
  const handleCheck = (event, key) => {
    setCurrentCheck(key);
    setChecked(event.target.checked);
  };
  const [orderlist, setOrderlist] = useState([]);
  const fetchOrders = async () => {
    const orderlist = (
      await axios.post(`/api/account/orders/orderHistory`, {
        external_customer_id,
        statuslist: [
          'success',
          'error',
          'refunded',
          'partially_refunded',
          'skipped',
          'pending_manual_payment',
          'pending',
        ],
      })
    ).data;

    setOrderlist(orderlist);
  };
  useEffect(() => {
    fetchOrders();
  }, []);
  Moment.locale('en');
  return (
    <div className="container px-4 mx-auto">
      <div className="mb-6 max-w-4xl mx-auto">
        <h2
          className="font-bold font-heading text-3xl mb-2 uppercase"
          style={{marginTop: '20px'}}
        >
          YOUR PAST ORDERS
        </h2>
        <p className="text-md">
          Click on the order # to track your order &amp; see shipping and
          billing information.
        </p>
      </div>
      {!orderlist.length ? (
        <div className="flex w-full justify-center items-center py-8 text-lg">
          •••
        </div>
      ) : (
        <>
          {orderlist.map((order, key) => (
            <div
              className="max-w-4xl mx-auto relative overflow-hidden mb-4"
              style={{backgroundColor: '#EFEFEF'}}
              key={key}
            >
              <input
                type="checkbox"
                name="radio-a"
                id={'check' + key}
                style={{position: 'absolute', opacity: 0, zIndex: -1}}
                checked={currentCheck == key && checked ? true : false}
                onChange={() => handleCheck(event, key)}
              />
              <label htmlFor={'check' + key}>
                <div className="accordion past_orders active w-full cursor-pointer">
                  <div className="flex flex-wrap">
                    <div className="w-full md:w-3/12 lg:w-3/12 py-4 px-8 mb-4 lg:mb-0">
                      Order Date
                      <br />
                      <span className="text-sm xl:text-lg lg:text-lg md:text-md mb-4 md:mb-0 font-bold">
                        {Moment(order.processed_at).format('MMM d, YYYY')}
                      </span>
                    </div>
                    <div className="w-full md:w-5/12 lg:w-5/12 py-4 px-8 mb-4 lg:mb-0">
                      Status
                      <br />
                      <span className="text-sm xl:text-lg lg:text-lg md:text-md mb-4 md:mb-0 font-bold">
                        {order.status}
                      </span>
                    </div>
                    <div className="w-full md:w-3/12 lg:w-3/12 py-4 px-8 mb-4 lg:mb-0">
                      <br />

                      <span className="text-sm xl:text-lg lg:text-lg md:text-md mb-4 md:mb-0 font-bold">
                        {' '}
                        Order #{' '}
                      </span>
                      <Link to={`/account/order-history/${order.id}`}>
                        <span
                          className="font-bold underline"
                          style={{fontSize: '18px', color: '#DB9707'}}
                        >
                          {order.id}
                        </span>
                      </Link>
                    </div>
                    <div className="w-full md:w-1/12 lg:w-1/12 py-4 px-8 mb-4 lg:mb-0">
                      <span className="ml-4">
                        <svg
                          className="w-4 h-4 font-bold"
                          width={18}
                          height={10}
                          viewBox="0 0 18 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M16.0185 0.999999C16.2905 0.732 16.7275 0.732 16.9975 0.999999C17.2675 1.268 17.2685 1.701 16.9975 1.969L9.0895 9.799C8.8195 10.067 8.3825 10.067 8.1105 9.799L0.2025 1.969C-0.0675004 1.701 -0.0675004 1.268 0.2025 1C0.4735 0.732 0.9115 0.732 1.1815 1L8.6005 8.141L16.0185 0.999999Z"
                            fill="#1F40FF"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </label>

              <div
                className="panel past_orders_desc max-h-0 flex flex-wrap"
                style={{
                  borderTop: '1px solid rgb(219, 151, 7)',
                  transition: 'all .3s',
                }}
              >
                <div className="w-full lg:w-4/6 p-8">
                  <div className="flex flex-wrap">
                    <div className="w-full sm:w-1/3 md:w-1/3 lg:w-1/3 px-8 mb-4 lg:mb-0 text-center">
                      <img
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          float: 'left',
                          marginRight: '20px',
                        }}
                        className="rounded-lg mb-0"
                        src={order.line_items[0].images.large}
                        alt=""
                      />
                    </div>
                    <div className="w-full sm:w-1/3 md:w-2/3 lg:w-2/3 px-8 mb-4 lg:mb-0">
                      <h2 className="mb-2 font-bold font-heading uppercase text-lg">
                        Products
                      </h2>
                      {order.line_items.map((item, key) => (
                        <p
                          className="text-lg text-black-500"
                          style={{lineHeight: '1.2'}}
                          key={key}
                        >
                          {item.quantity} x {item.variant_title}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
                {/* <div className="w-full lg:w-1/6 px-4" ><p>{order.payment_processor}</p></div> */}
                <div className="w-full lg:w-1/6 px-4 text-right" />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default Index;
