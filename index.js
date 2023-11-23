require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q40mozm.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const dbConnect = async () => {
  try {
    client.connect();
    console.log("DB Connected Successfully✅");
  } catch (error) {
    console.log(error.name, error.message);
  }
};
dbConnect();

// middlewares
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access." });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access." });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "forbidden access." });
    }
    req.decoded = decoded;
    next();
  });
};

const dataBase = client.db("bistroBoss");
const usersCollection = dataBase.collection("usersDB");
const menusCollection = dataBase.collection("menusDB");
const cartCollection = dataBase.collection("cartDB");
const paymentsCollection = dataBase.collection("paymentsDB");

// jwt api
app.post("/jwt", (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });
  res.send({ token });
});

// user related api
app.put("/users", async (req, res) => {
  const userInfo = req.body;
  const filter = { email: userInfo?.email };
  const isExists = await usersCollection.findOne(filter);
  if (isExists) {
    return res.send({ exists: true });
  }
  const options = { upsert: true };
  const updatedUser = {
    $set: {
      email: userInfo?.email,
      name: userInfo?.name,
      photoURL: userInfo?.photoURL,
      role: userInfo?.role,
    },
  };
  const result = await usersCollection.updateOne(filter, updatedUser, options);
  res.send(result);
});

// menu related api
app.post("/menus", async (req, res) => {
  const menuInfo = req.body;
  const result = await menusCollection.insertOne(menuInfo);
  res.send(result);
});

app.get("/menus", async (req, res) => {
  const menuCategory = req.query.category;
  let query = {};
  if (menuCategory) {
    query = { category: menuCategory };
  }
  const result = await menusCollection.find(query).toArray();
  res.send(result);
});

// cart related api
app.get("/cart/:email", verifyToken, async (req, res) => {
  console.log(req.decoded.email);
  const userEmail = req.params.email;
  const query = { email: userEmail };
  const result = await cartCollection.find(query).toArray();
  res.send(result);
});

app.post("/cart", verifyToken, async (req, res) => {
  const cartInfo = req.body;
  const result = await cartCollection.insertOne(cartInfo);
  res.send(result);
});

app.delete("/cart/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await cartCollection.deleteOne(query);
  res.send(result);
});

// payment related api
app.post("/create-payment-intent", verifyToken, async (req, res) => {
  const { price } = req.body;
  const amount = parseInt(price * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    payment_method_types: ["card"],
  });
  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

app.post("/payments", verifyToken, async (req, res) => {
  const paymentInfo = req.body;
  const paymentResult = await paymentsCollection.insertOne(paymentInfo);

  const query = {
    _id: {
      $in: paymentInfo?.cartId?.map((id) => new ObjectId(id)),
    },
  };
  const deletedResult = await cartCollection.deleteMany(query);

  res.send({ paymentResult, deletedResult });
});

app.get("/payments/history/:email", verifyToken, async (req, res) => {
  const userEmail = req.params.email;
  const query = { email: userEmail };
  const result = await paymentsCollection.find(query).toArray();
  res.send(result);
});

// connection  api
app.get("/", (req, res) => {
  res.send("server is running data will be appear soon...");
});

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});
