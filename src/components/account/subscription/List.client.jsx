import {Link} from '@shopify/hydrogen';
import axios from 'axios';
import {useEffect} from 'react';
import {getUsaStandard} from '~/utils/dates';

const Index = ({subscriptions, user}) => {
  //initialize a new token when in home page
  useEffect(() => {
    const getToken = async () => {
      await axios.post(`/api/bundleAuth/setSession`, {
        email: user.email,
      });
      const res = (await axios.get(`/api/authToken`)).data;
    };
    getToken();
  }, []);
  return (
    <div className="flex flex-wrap">
      <div className="w-full max-w-2xl mb-4 text-3xl uppercase font-bold ml-4">
        YOUR SUBSCRIPTION ORDERS
      </div>
      {!subscriptions.length ? (
        <div className="w-full py-2 text-lg ml-4">
          <h3 className="py-5">You have no active subscriptions</h3>
          <Link to={`/shop/bundle/family-feastbox`}>
            <button className="bg-[#DB9707] px-3 py-2 rounded-sm text-white font-bold">
              SUBSCRIBE AND SAVE NOW
            </button>
            </Link>
        </div>
      ) : (
        <>
          <div className="w-full max-w-2xl mb-4 text-lg ml-4">
            Edit your active subscription.
          </div>
          {subscriptions.map((subscription, key) => (
            <div key={key} className="w-full  p-4 ">
              {/*-------Subscription box--------------------------*/}
              <div className="container px-4 mx-auto subscription_box">
                <style
                  dangerouslySetInnerHTML={{
                    __html:
                      "\n                    .subscription_box{\n                      background-color: #EFEFEF;\n                      box-shadow: 0 0 2px #0000004d;\n                      border-radius: 5px;\n                      padding-top: 25px;\n                      padding-right: 15px;\n                      padding-left: 15px;\n                    }\n      \n      \n      \n                    #address:before {\n                      content: '';\n                      position: absolute;\n                      top: 50%;\n                      left: 0;\n                      width: 92%;\n                      height: 1px;\n                      background-color: #bca79c;\n                      margin: 0 40px;\n                    }\n                    .address{\n                      position: relative;\n                      z-index: 1;\n                      display: inline-block;\n                      padding-right: 20px;\n                      background-color: #EFEFEF;\n                      font-size: 16px;\n                      font-weight: 500;\n                      line-height: 1.3;\n                      color: #5a3b36;\n                    }\n      \n                    #product_count{\n                      position: relative;\n                      display: inline-block;\n      \n                    }\n      \n                    #product_count:before {\n                      position: absolute;\n                      top: -10px;\n                      right: -10px;\n                      background-color: #bca79c;\n                      border-radius: 50px;\n                      width: 22px;\n                      height: 22px;\n                      text-align: center;\n                      font-size: 18px;\n                      font-weight: 700;\n                      line-height: 23px;\n                      color: #fff;\n                      z-index: 10;\n                    }\n      \n                    .discount_code__close-btn {\n                      /*position: absolute;*/\n                      top: 50%;\n                      right: 0;\n                      transform: translateY(-50%);\n                      display: flex;\n                      justify-content: center;\n                      align-items: center;\n                      width: 38px;\n                      height: 100%;\n                      padding: 0;\n                      background-color: transparent;\n                    }\n                  ",
                  }}
                />
                <div className="flex flex-wrap -mx-4 -mb-0">
                  <div
                    id="address"
                    className="w-full mb-12 px-4"
                    style={{position: 'relative'}}
                  >
                    <span
                      style={{
                        color: 'rgb(90, 59, 54)',
                        fontFamily: 'AvenirNext, sans-serif',
                        fontSize: 16,
                        backgroundColor: '#EFEFEF',
                        margin: '0 10px',
                      }}
                      className=" text-lg text-gray-500 leading-loose address"
                    >
                      {subscription.address.address1}
                    </span>
                  </div>
                  <div className="w-full lg:w-1/5 px-4 mb-0 ">
                    <div
                      id="product_count"
                      className="mb-6 before:content-none "
                    >
                      <div className="absolute flex justify-center items-center z-10 -top-3 -right-3 rounded-full w-6 h-6 bg-[#bca79c] text-white font-bold">
                        {subscription.quantity}
                      </div>
                      <img
                        style={{position: 'relative', zIndex: 1}}
                        className="rounded-lg mb-0 w-100 md:w-[1000px] lg:w-[100px]"
                        // width={100}
                        // height={100}
                        src={
                          typeof subscription?.product?.images?.small !==
                          'undefined'
                            ? subscription?.product?.images?.small
                            : ''
                        }
                        alt="img"
                      />
                    </div>
                  </div>

                  <div className="w-full lg:w-1/3 px-4 mb-4 md:mb-0 visible lg:hidden overflow-hidden position: relative;">
                    <div className="w-full mb-4 md:mb-0">
                      <Link
                        className="block py-2 text-lg text-center uppercase font-bold "
                        to={`/account/subscriptions/${subscription.id}`}
                        style={{
                          backgroundColor: '#DB9707',
                          color: '#FFFFFF',
                          marginBottom: 15,
                        }}
                      >
                        Edit Subscription
                      </Link>
                    </div>
                  </div>

                  <div className="w-full lg:w-1/5 px-4 py-2 lg:py-0 grid  grid-cols-3 lg:grid-cols-1">
                    <div>
                    <h2 className="lg:mb-2 font-bold font-heading uppercase text-lg">
                      Products
                    </h2>
                    </div>
                    <div className='w-1/3'></div>
                    <div>
                    <p
                      className="text-sm lg:text-lg font-bold lg:font-normal text-black lg:text-gray-500 lg:mt-[-60px]"
                      
                    >
                      {subscription.quantity} x {subscription.product_title}
                    </p>
                    </div>
                  </div>

                  <div className="w-full lg:w-1/5 px-4 py-2 lg:py-0 grid  grid-cols-3 lg:grid-cols-1 lg:visible">
                  <div>
                    <h2 className="lg:mb-2 font-bold font-heading uppercase text-lg">
                      Total
                    </h2>
                    </div>
                    <div className='w-1/3'></div>
                    <div>
                    <p
                       className="text-lg lg:text-lg font-bold lg:font-normal text-black lg:text-gray-500 lg:mt-[-60px]"
                    >
                      ${subscription.price}
                    </p>
                    </div>
                    {/* <Link
                      className="flex items-center text-lg font-bold text-gray-700 hover:text-gray-800"
                      to=""
                    >
                      <span className="underline text-sm">Details</span>
                      <span></span>
                    </Link> */}
                  </div>
                  <div className="w-full lg:w-1/5 px-4 py-2 lg:py-0 grid  grid-cols-3 lg:grid-cols-1">
                    <div>
                    <h2 className="lg:mb-2  font-heading uppercase text-lg lg:font-bold">
                    FREQUENCY
                    </h2>
                    </div>
                    <div className='w-1/3'></div>
                    <div>
                    <p
                      className="text-sm lg:text-lg font-bold lg:font-normal text-black lg:text-gray-500 lg:mt-[-60px]"
                      
                    >
                      {subscription.order_interval_frequency} Days
                    </p>
                    </div>
                  </div>

                  <div className="w-full lg:w-1/5 px-4 py-2 lg:py-0 grid  grid-cols-3 lg:grid-cols-1">
                    <div>
                    <h2 className="lg:mb-2 font-heading uppercase text-lg lg:font-bold">
                    NEXT ORDER
                    </h2>
                    </div>
                    <div className='w-1/3'></div>
                    <div>
                    <p
                      className="text-sm lg:text-lg font-bold lg:font-normal text-black lg:text-gray-500 lg:mt-[-60px]"
                      
                    >
                      {getUsaStandard(subscription.next_charge_scheduled_at)}
                    </p>
                    </div>
                  </div>
                </div>
                {/*---------edit subscription button---------*/}
                <div className="flex flex-wrap -mx-4 -mb-4 md:mb-0 ">
                  <div className="w-full md:w-1/3 px-4 mb-4 md:mb-0">
                    <div className="w-full mb-4 md:mb-0"></div>
                  </div>
                </div>
                {/*---------------form open---------------*/}
                <div className="flex flex-wrap -mx-4 -mb-4 md:mb-0">
                  <div className="w-full md:w-2/3 px-4 mb-4 md:mb-0 text-right"></div>
                  <div className="w-full md:w-1/3 px-4  md:mb-0 invisible lg:visible " >
                    <div className="w-full mb-4 md:mb-0">
                      <Link
                        className="block py-2 text-lg text-center uppercase font-bold "
                        to={`/account/subscriptions/${subscription.id}`}
                        style={{
                          backgroundColor: '#DB9707',
                          color: '#FFFFFF',
                          marginBottom: 15,
                        }}
                      >
                        Edit Subscription
                      </Link>
                    </div>
                  </div>
                </div>
                {/*--------end edit subscription button----------*/}
              </div>
              {/*-------End Subscription Box--------------------------*/}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default Index;
