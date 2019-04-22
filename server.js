const express = require('express');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const socket = require('socket.io');
const ObjectID = require('mongodb').ObjectID;
const port = 3000;

const app = express();
app.use(bodyParser.json());

const MongoClient = mongodb.MongoClient;

let db;
let users;
let count;
let chatRooms;

app.use((req, res, next) => {
  res.append('Access-Control-Allow-Origin' , '*');
  res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.append("Access-Control-Allow-Headers", "Origin, Accept,Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
  res.append('Access-Control-Allow-Credentials', true);
  next();
});

MongoClient.connect('mongodb://localhost:27017/Moodster_App', (err, Database) => {
  if(err) {
    console.log(err);
    return false;
  }

  db = Database.db("Moodster_App");
  users = db.collection("users");
  chatRooms = db.collection("chatRooms");

  const server = app.listen(port, () => {
    console.log("Server started on port " + port + "...");
  });

  const io = socket.listen(server);

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
    });
}); 

app.get('/', (req, res, next) => {
  res.send('Express Server Started');
});

app.post('/api/users', (req, res, next) => {
  let user = {
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    mood: req.body.mood
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

app.get('/api/users', (req, res, next) => {
  users.find({}, {username: 1, email: 1, _id: 0}).toArray((err, users) => {
    if(err) {
      res.send(err);
    }
    res.json(users);
  });
});


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

