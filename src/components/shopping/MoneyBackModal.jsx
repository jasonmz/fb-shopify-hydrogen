export default function MoneyBackModal({setOpenModal}) {
  return (
    <>
      <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
        <div className="relative w-auto my-10 mx-auto max-w-3xl">
          {/*content*/}
          <div className="border-0 shadow-lg relative flex flex-col w-80 sm:w-full bg-white outline-none focus:outline-none">
            {/*header*/}
            <button
              type="button"
              className="absolute top-[15px] right-[10px] text-gray-800"
              onClick={() => setOpenModal(false)}
            >
              <span className="sr-only">Close</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="black 800"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <div className="p-10 text-center">
              <p style={{fontSize: 36}} className="font-bold">
                100% Money Back Guarantee
              </p>
              <br />
              <p style={{fontSize: 22}} className="font-bold">
                We stand by our delicious food, and the good we are doing
                feeding families across the country.
              </p>
              <br />
              <p style={{fontSize: 20}}>
                Get a full refund for your FEASTbox if you don’t love our food.
                Eating good shouldn’t be stressful, so we want to make it as
                easy as possible.{' '}
              </p>
            </div>
            <div
              onClick={() => setOpenModal(false)}
              className="bg-[#DB9707] py-4 text-white text-bold text-base text-center cursor-pointer"
            >
              Close
            </div>
          </div>
        </div>
      </div>
      <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
    </>
  );
}
