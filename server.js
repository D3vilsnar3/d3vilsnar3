const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3939;
const HOST = "0.0.0.0";

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, HOST, () => {
  console.log(`Portfolio running on http://${HOST}:${PORT}`);
  console.log(`Local:     http://localhost:${PORT}`);
  console.log(`Tailscale: http://100.89.147.43:${PORT}`);
});
