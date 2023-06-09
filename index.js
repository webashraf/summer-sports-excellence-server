const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const jwt = require('jsonwebtoken');

// middleware //
app.use(cors());
app.use(express.json());
const jwtVerify = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    console.log('errror: 1');
    return res.status(401).send({error: true, message: 'invalid authorization'});
  }
  const token = authorization.split(' ')[1];
  console.log(token);
  jwt.verify(token, process.env.JWT_TOKEN, (error, decoded) =>{
    if (error) {
      console.log('errror: 2');
      return res.status(401).send({error: true, message: 'unauthorized access'});
    }
    req.decoded = decoded;
    next();
  })
}






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
    const selectedClassCollection = client.db('summerCampDB').collection('selectedClasses')




    // Get JWT token //
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, {expiresIn: '1hr'})
      res.send({token})
    })



    // Global Operations //
    ///////////////////////
    // get all class from classCollection //
    app.get('/allClasses', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })

    // get all users from userCollection //
    app.get('/allUsers', jwtVerify, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    // Find user role from userCollections //
    app.get('/isAdmin/:email', async (req, res) => {
      const userEmail = req.params.email;
      const user = await userCollection.findOne({ email: userEmail });
      // console.log('email', userEmail, 'user', user);
      if (user?.role === 'admin') {
        res.send({ admin: true });
      }
    })
    app.get('/isInstructor/:email', async (req, res) => {
      const userEmail = req.params.email;
      const user = await userCollection.findOne({ email: userEmail });
      // console.log('email', userEmail, 'user', user);
      if (user?.role === 'instructor') {
        res.send({ instructor: true });
      }
    })
    app.get('/isUser/:email', async (req, res) => {
      const userEmail = req.params.email;
      const user = await userCollection.findOne({ email: userEmail });
      // console.log('email', userEmail, 'user', user);
      console.log(!user?.role);
      if (!user?.role) {
        res.send({ user: true });
      }
    })
/////////////////////////////////////////////////////////////////////////////////



    // Classes page operations //
    // get all approved class from classCollection //
    app.get('/approvedClasses', async (req, res) => {
      const result = await classCollection.find({ status: "approved" }).toArray();
      res.send(result)
    })
    // Insert students selected class in the mongodb using post method //
    app.post('/selectedClass/:id', async (req, res) => {
      const id = req.params.id;
      const studentEmail = req.body.email;
      console.log(studentEmail);
      const query = { _id: new ObjectId(id) };
      const selectedClass = await classCollection.findOne(query);
      const allReadySelected = await selectedClassCollection.findOne({ classId: id });
      // console.log();
      if (allReadySelected?.classId === id) {
        return res.send('Class allready selected');
      }
      else {
        const newSelectedClass = {
          classId: id,
          classPhoto: selectedClass.photoUrl,
          className: selectedClass.className,
          instructorName: selectedClass.instructorName,
          instructorEmail: selectedClass.instructorEmail,
          price: selectedClass.price,
          studentEmail
        }
        const result = await selectedClassCollection.insertOne(newSelectedClass);
        res.send(result)
      }
    })



    // User Dashboard Operations //
    // find selected class by students //
    app.get('/selectedClasses/:email', jwtVerify, async(req, res) => {
      const userEmail = req.params.email;
      const query = {studentEmail: userEmail};
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    })
    // Delete selected class from selectedClassCollection //
    app.delete('/deleteSelectedClass/:id',jwtVerify, async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    })




    // Instructor Operations //
    // Add new class in mongodb class collection by adding from instructor //
    app.post('/addclass', async (req, res) => {
      const classData = req.body;
      const result = await classCollection.insertOne(classData);
      res.send(result)
    })

    // get spacific instructor all classes //
    app.get('/allClasses/:email', async (req, res) => {
      const userEmail = req.params.email;
      const query = { instructorEmail: userEmail };
      // console.log('email 1', userEmail,'email query', query);
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })

    /* add new user in to the userCollection */
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
    // add user status like admin instructor //
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

    // Add admin feedback about instructor class //
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
    // Update use role like admin instructor //
    app.put('/adminRoleUpdate/:id', async (req, res) => {
      const id = req.params.id;
      const userRole = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
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