const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();

// middleware //
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.37yfgb3.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const classCollection = client.db('summerCampDB').collection('classes')
    const userCollection = client.db('summerCampDB').collection('users')




    // Global Operations //
    app.get('/allClasses', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })
    app.get('/allUsers', async(req, res)=> {
      const result = await userCollection.find().toArray();
      res.send(result);
    })
    app.get('/isAdmin/:email', async(req, res) => {
      const userEmail = req.params.email;
      const user = await userCollection.findOne({ email: userEmail });
      // console.log('email', userEmail, 'user', user);
      if (user?.role === 'admin') {
        res.send({admin: true});
      }
    })    
    app.get('/isInstructor/:email', async(req, res) => {
      const userEmail = req.params.email;
      const user = await userCollection.findOne({ email: userEmail });
      // console.log('email', userEmail, 'user', user);
      if (user?.role === 'instructor') {
        res.send({instructor: true});
      }
    })




    // Instructor Operations //
    app.post('/addclass', async (req, res) => {
      const classData = req.body;
      const result = await classCollection.insertOne(classData);
      res.send(result)
    })
    app.get('/allClasses/:email', async (req, res) => {
      const userEmail = req.params.email;
      const query = { instructorEmail: userEmail };
      // console.log('email 1', userEmail,'email query', query);
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })
    app.post('/users', async (req, res) => {
      const body = req.body;
      const query = { email: body.email };
      const existingUser = await userCollection.findOne(query);
      // console.log(query, existingUser, body.email);
      if (existingUser) {
        return res.send('User already exists');
      }
      else {
        const result = await userCollection.insertOne(body);
        res.send(result);
      }
    })



    // Admin Operations //
    app.put('/updateStatus/:id', async (req, res) => {
      const id = req.params.id;
      const statusData = req.body;
      const instructorStatus = statusData.status;
      // console.log('id', id, 'status', instructorStatus);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateStatus = {
        $set: {
          status: instructorStatus,
        }
      }
      const result = await classCollection.updateOne(filter, updateStatus, options);
      res.send(result);
    })
    app.put('/classFeedbackUpdate/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const feedback = data.feedback;
      const filter = { _id: new ObjectId(id) };
      // console.log(id, data, feedback);
      const options = { upsert: true };
      const newFeedback = {
        $set: {
          adminFeedback: feedback,
        }
      }
      const result = classCollection.updateOne(filter, newFeedback, options);
      res.send(result);
    })
    app.put('/adminRoleUpdate/:id', async (req, res) => {
      const id = req.params.id;
      const userRole = req.body;
      const filter = {_id: new ObjectId(id)};
      const options = {upsert: true};
      const updateRole = {
        $set: {
          role: userRole.role,
        }
      }
      const result = await userCollection.updateOne(filter, updateRole, options);
      res.send(result);
    })













    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




























app.get('/', (req, res) => {
  res.send('Summer Sports Excellence is running')
})

app.listen(port, () => {
  console.log(`http://localhost:${port}/`);
})