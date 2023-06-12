const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_METHOD_PK);


// middleware //
app.use(cors());
app.use(express.json());
const jwtVerify = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    console.log('errror: 1');
    return res.status(401).send({ error: true, message: 'invalid authorization' });
  }
  const token = authorization.split(' ')[1];
  // console.log(token);
  jwt.verify(token, process.env.JWT_TOKEN, (error, decoded) => {
    if (error) {
      console.log('errror: 2');
      return res.status(401).send({ error: true, message: 'unauthorized access' });
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
    // await client.connect();
    const classCollection = client.db('summerCampDB').collection('classes')
    const userCollection = client.db('summerCampDB').collection('users')
    const selectedClassCollection = client.db('summerCampDB').collection('selectedClasses')
    const paymentCollection = client.db('summerCampDB').collection('collectedPayment')




    // Payment method implement //
    app.post('/createPaymentIntent', jwtVerify, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const courseAmount = parseInt(amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: courseAmount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      })

    })
    app.get('/single_course_for_payment/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.findOne(query);
      res.send(result);
    })




    app.post('/payment', jwtVerify, async (req, res) => {
      const paymentHistory = req.body;
      const result = await paymentCollection.insertOne(paymentHistory);

      const filter = { _id: new ObjectId(paymentHistory.classId) };
      const instructorClass = await classCollection.findOne(filter);
      const previousSeats = instructorClass.seats;
      const totalSeats = parseFloat(previousSeats) - 1;
      const enrolled = instructorClass?.enrolled || 0;
      const newEnrolled = enrolled + 1;

      const updatedSeats = {
        $set: {
          seats: totalSeats,
          enrolled: newEnrolled,
        }
      }
      const updateSeats = await classCollection.updateOne(filter, updatedSeats);


      const query = { classId: paymentHistory.classId };
      console.log('query', query);
      const deleteCourse = await selectedClassCollection.deleteOne(query);
      console.log('deleteCourse', deleteCourse);

      res.send({ result, deleteCourse, updateSeats })
    })






    // Get JWT token //
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: '1hr' })
      res.send({ token })
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
    app.get('/isAdmin/:email', jwtVerify, async (req, res) => {
      const email = req.decoded.email;
      if (!email) {
        return res.status(403).send({ error: true, message: 'forbidden email' })
      }
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
    app.get('/isUser/:email', jwtVerify,async (req, res) => {
      const email = req.decoded.email;
      if (!email) {
        return res.status(403).send({error: true, message: 'forbidden email'})
      }
      const userEmail = req.params.email;
      const user = await userCollection.findOne({ email: userEmail });

      if (!user?.role) {
        res.send({ user: true });
      }
    })
    /////////////////////////////////////////////////////////////////////////////////

    // Home Page Operations //
    app.get('/allInstructorsClasses', async (req, res) => {

      const filter = { status: "approved" };
      const sorting = {
        sort: { enrolled: -1 }
      };
      const result = await classCollection.find(filter, sorting).toArray();
      res.send(result);

    })


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
      const query = { _id: new ObjectId(id) };
      const selectedClass = await classCollection.findOne(query);
      const allReadySelected = await selectedClassCollection.findOne({ classId: id });
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
    app.get('/selectedClasses/:email', jwtVerify, async (req, res) => {
      const email = req.decoded.email;
      if (!email) {
        return res.status(403).send({error: true, message: 'forbidden email'})
      }
      const userEmail = req.params.email;
      const query = { studentEmail: userEmail };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    })
    // Delete selected class from selectedClassCollection //
    app.delete('/deleteSelectedClass/:id', jwtVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/enrolledClass/:email', jwtVerify, async (req, res) => {
      const email = req.decoded.email;
      if (!email) {
        return res.status(403).send({error: true, message: 'forbidden email'})
      }
      const userEmail = req.params.email;
      const query = { studentEmail: userEmail };
      const options = {
        sort: { paymentTime: -1 }
      }
      const result = await paymentCollection.find(query, options).toArray();
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
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })

    /* add new user in to the userCollection */
    app.post('/users', async (req, res) => {
      const body = req.body;
      const query = { email: body.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send('User already exists');
      }
      else {
        const result = await userCollection.insertOne(body);
        res.send(result);
      }
    })


    app.get('/instructors', async (req, res) => {
      const query = { role: 'instructor' };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    })



    // Admin Operations //
    // add user status like admin instructor //
    app.put('/updateStatus/:id', async (req, res) => {
      const id = req.params.id;
      const statusData = req.body;
      const instructorStatus = statusData.status;
      const filter = { _id: new ObjectId(id) };
      const instructorClass = await classCollection.findOne(filter);

      const secondFilter = { instructorEmail: instructorClass.instructorEmail };
      const instructorAllClasses = await classCollection.find(secondFilter).toArray();
      const approvedAllClass = instructorAllClasses.filter(approvedClass => approvedClass.instructorEmail === instructorClass.instructorEmail && approvedClass.status === 'approved')
      const approvedClassName = approvedAllClass.map(approvedClass => approvedClass.className);
      const thirdFilter = { email: instructorClass.instructorEmail }
      const options = { upsert: true };

      const updateStatus = {
        $set: {
          status: instructorStatus,
        }
      }
      const result = await classCollection.updateOne(filter, updateStatus, options);
      const updateInstructorInfoToUserCollection = {
        $set: {
          classes: approvedClassName,
          totalClass: approvedClassName.length,
        }
      }

      if (result.acknowledged) {
        const updateInstructorUserInfo = await userCollection.updateOne(thirdFilter, updateInstructorInfoToUserCollection, options);
        res.send({ result, updateInstructorUserInfo });
      }
    })

    // Add admin feedback about instructor class //
    app.put('/classFeedbackUpdate/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const feedback = data.feedback;
      const filter = { _id: new ObjectId(id) };
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
    // await client.db("admin").command({ ping: 1 });
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