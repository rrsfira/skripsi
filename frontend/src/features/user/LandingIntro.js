import TemplatePointers from "./components/TemplatePointers";

function LandingIntro() {
  return (
    <div className="hero min-h-full bg-base-200 md:rounded-l-xl">
      <div className="hero-content py-8 sm:py-10 md:py-12 px-4 sm:px-6">
        <div className="max-w-md">
          <div className="text-center mt-8 sm:mt-12">
            <img
              src="/logo1.svg"
              alt="PT OTAK KANAN"
              className="w-36 sm:w-44 md:w-48 mx-auto block"
            />
          </div>

          {/* Importing pointers component */}
          <TemplatePointers />
        </div>
      </div>
    </div>
  );
}

export default LandingIntro;
