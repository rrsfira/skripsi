import TemplatePointers from "./components/TemplatePointers"



function LandingIntro(){

    return(
        <div className="hero min-h-full bg-base-200 md:rounded-l-xl">
            <div className="hero-content py-8 sm:py-10 md:py-12 px-4 sm:px-6">
              <div className="max-w-md">

              <h1 className='text-2xl sm:text-3xl text-center font-bold'><img src="/logo192.png" className="w-10 sm:w-12 inline-block mr-2 mask mask-circle" alt="dashwind-logo" />DashWind</h1>

                <div className="text-center mt-8 sm:mt-12"><img src="./intro.png" alt="Dashwind Admin Template" className="w-36 sm:w-44 md:w-48 inline-block"></img></div>
              
              {/* Importing pointers component */}
              <TemplatePointers />
              
              </div>

            </div>
          </div>
    )
      
  }
  
  export default LandingIntro