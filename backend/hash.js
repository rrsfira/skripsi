const bcrypt = require("bcryptjs");

(async () => {
    console.log(await bcrypt.hash("password123", 10));
})();
