import nexo from "@tiendanube/nexo";

const instance = nexo.create({
  clientId: import.meta.env.VITE_CLIENT_ID,
  log: import.meta.env.DEV,
});

export default instance;