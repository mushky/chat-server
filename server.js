// using express
const express = require('express');
// using bodyParser
const bodyParser = require('body-parser');
// using mongodb
const mongodb = require('mongodb');
// using socket io
const socket = require('socket.io');
// using ObjectId to grab BSON id from mongoDb objects
const ObjectID = require('mongodb').ObjectID;
// Running on Port 3000
const port = 3000;

// App definition 
const app = express();
// using bodyparser
app.use(bodyParser.json());

// Creating a Mongo Client
const MongoClient = mongodb.MongoClient;

// Defining the Database and the collection types
let db;
let users;
let count;
let chatRooms;

// What will be appended to every header request
app.use((req, res, next) => {
  res.append('Access-Control-Allow-Origin' , '*');
  res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.append("Access-Control-Allow-Headers", "Origin, Accept,Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
  res.append('Access-Control-Allow-Credentials', true);
  next();
});

// Identifying where the mongodb database is actually located and what set of collections to look for
MongoClient.connect('mongodb://localhost:27017/Moodster_App', (err, Database) => {
  
  // if there's an error with the connection log the error to the terminal
  if(err) {
    console.log(err);
    return false;
  }

  // Identify the database as moodster_app
  db = Database.db("Moodster_App");
  // Identify the users collection within the database
  users = db.collection("users");
  // Identify the chatrooms collection 
  chatRooms = db.collection("chatRooms");

  // Define the server and begin listening on port 3000
  const server = app.listen(port, () => {
    console.log("Server started on port " + port + "...");
  });

  // Define socket io and tell it to listen to the pre-defined server
  const io = socket.listen(server);

  // Sockets
  io.sockets.on('connection', (socket) => {
    socket.on('join', (data) => {
      socket.join(data.room);
        chatRooms.find({}).toArray((err, rooms) => {
          if(err){
            console.log(err);
            return false;
          }
          count = 0;
          rooms.forEach((room) => {
            if(room.name == data.room){
              count++;
            }
          });
          if(count == 0) {
            chatRooms.insert({ name: data.room, messages: [] }); 
          }
        });
      });

      socket.on('message', (data) => {
        io.in(data.room).emit('new message', {user: data.user, message: data.message});
          chatRooms.update({name: data.room}, { $push: { messages: { user: data.user, message: data.message } } }, (err, res) => {
            if(err) {
              console.log(err);
              return false;
            }
              console.log("Document updated: " + data.user + " " + data.message);
          });
        });

        socket.on('typing', (data) => {
          socket.broadcast.in(data.room).emit('typing', {data: data, isTyping: true});
        });

        // Notifications
    });
}); 

// Index
app.get('/', (req, res, next) => {
  res.send('Express Server Started');
});

// Create new user
app.post('/api/users', (req, res, next) => {
  let user = {
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    mood: req.body.mood,
    messages: {}
  };

  let count = 0;    
  
  users.find({}).toArray((err, Users) => {
    if (err) {
      console.log(err);
      return res.status(500).send(err);
    }
    for(let i = 0; i < Users.length; i++){
      if(Users[i].username === user.username)
      count++;
    }
    if(count == 0){
      users.insert(user, (err, User) => {
        if(err){
          res.send(err);
        }
          res.json(User);
        });
    }
    else {
      res.json({ user_already_signed_up: true });
    }
  });
});

// Login user
app.post('/api/login', (req, res) => {
  let isPresent = false;
  let correctPassword = false;
  let loggedInUser;

  users.find({}).toArray((err, users) => {
    if(err) {
      return res.send(err);
    }
    users.forEach((user) => {
      if((user.username == req.body.username)) {
        if(user.password == req.body.password) {
          isPresent = true;
          correctPassword = true;
          loggedInUser = {
            username: user.username,
            email: user.email
          }    
          } else {
            isPresent = true;
          }
        }
      });
    res.json({ isPresent: isPresent, correctPassword: correctPassword, user: loggedInUser });
  });
});

// Add a Message to the user
app.post('/api/users/notifications', (req, res) => {
  let notification = req.body.notification;
  let notifiedUser;

  console.log(notification.username);
  // 1. Obtain the user
  users.find({}).toArray((err, users) => {
    if (err) {
      console.log(err);
      return res.send(err);
    }
    users.forEach((user) => {
      console.log(req.body.notification);
      if((user.username === notification.username)) {
        // Construct Return Object
        notifiedUser = {
          notices: notification
        }
        // Update the database with the new message
        db.collection("users").updateOne(
          { username: user.username },
          { $push: { notices: notification }}
        )
      } else {
        console.log("messages error");
      }
    });
    res.json({user: notifiedUser});

  })
});

// Get all users
app.get('/api/users', (req, res, next) => {
  users.find({}, {username: 1, email: 1, _id: 0}).toArray((err, users) => {
    if(err) {
      res.send(err);
    }
    res.json(users);
  });
});

// Get user by username
app.get('/api/users/:username', (req,res) => {
  let returnedUser;
  users.find({}).toArray((err, users) => {
    if (err) {
      return res.send(err);
    }
    users.forEach((user) => {
      if ((user.username === req.params.username)) {
        returnedUser = {
          username: user.username,
          email: user.email,
          mood: user.mood,
          notices: user.notifications
        }
        console.log(returnedUser);
      }
    });
    console.log(returnedUser);
    res.json({user: returnedUser});
  })
})


// Get Chatroom by room
app.get('/chatroom/:room', (req, res, next) => {
  let room = req.params.room;
  chatRooms.find({name: room}).toArray((err, chatroom) => {
    if(err) {
      console.log(err);
      return false;
    }
    res.json(chatroom[0].messages);
    console.log(chatroom);
  });
});


// Change User Mood
app.put('/api/users/:username/mood', (req, res) => {
  const username = req.params.username;
  const new_mood = req.body.mood;
  let name = { username: req.params.username }
  let updatedValues = { $set: {mood: new_mood } };
  
  db.collection("users").updateOne(name, updatedValues, (err, res) => {
    if (err) {
      throw err;
    }

    console.log(username + "'s" + ' Mood updated to: ' + req.body.mood);
  });
  
  res.json({ 
    username: req.params.username, 
    body_mood: req.body.mood 
  });

});

