function Footer() {
    return (
      <>
        <section className="w-full bg-white flex flex-col items-center justify-center p-12 text-center">
          <h2 className="text-4xl font-bold mb-4 text-black google-sans">Build. Draw. Iterate.</h2>
          <p className="max-w-md text-gray-600 mb-6">
            Your ideas stay in your spaces. Draw, edit, and collaborate without distractions.
          </p>
        </section>
  
        <footer className="bg-black text-white py-10 text-center">
  <div className="flex flex-col gap-3">
    <p className="text-sm text-gray-400">Drew</p>
    <p className="text-xs text-gray-500">© {new Date().getFullYear()} Drew. All rights reserved.</p>
  </div>
</footer>
      </>
    );
  }
  
  export default Footer;
  