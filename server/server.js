const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');

const { generateMessage, generateLocationMessage } = require('./utils/message');
const { isRealString } = require('./utils/isRealString');
const { Users } = require('./utils/users');


const publicPath = path.join(__dirname, '/../public');
const port = process.env.PORT || 3000
let app = express();
// let server = http.createServer(app);
const server = app.listen(port, () => {
  console.log(`server running on port ${port}`);
});



let io = socketIO(server);
let users = new Users();

app.use(express.static(publicPath));

const getVisitors = () => {
  let clients = io.sockets.clients().connected;
  let sockets = Object.values(clients);
  let userx = sockets.map(s => s.user);
  return userx;
};

const emitVisitors = () => {
  io.emit("visitors", getVisitors());
};

io.on('connection', (socket) => {
  console.log("A new user just connected");
  socket.on('add_user', (data, callback) => {
    users.addNewUser(socket.id, data.name, data.room, data.userId, data.isOnline);
    io.emit("visitors", users.getUsers());
  })

  socket.on('join', (data, callback) => {
    if (!isRealString(data.name) || !isRealString(data.room)) {
      return callback('Name and room are required');
    }

    socket.join(data.room);
    users.removeUser(socket.id);
    users.addUser(socket.id, data.name, data.room, data.userId, data.isOnline);
    io.emit("visitors", users.getUsers());
    io.to(data.room).emit('updateUsersList', users.getUserList(data.room));
    socket.emit('newMessage', generateMessage('Admin', `Welocome to ${data.room}!`));
    socket.broadcast.to(data.room).emit('newMessage', generateMessage('Admin', "New User Joined!"));
    callback();
  })

  socket.on('createMessage', (message, callback) => {
    let user = users.getUser(socket.id);
    if (user && isRealString(message.text)) {
      io.to(user.room).emit('newMessage', generateMessage(user.name, message.text));
    }
    callback('This is the server:');
  })

  socket.on('createLocationMessage', (coords) => {
    let user = users.getUser(socket.id);

    if (user) {
      io.to(user.room).emit('newLocationMessage', generateLocationMessage(user.name, coords.lat, coords.lng))
    }
  })

  socket.on('disconnect', () => {
    console.log(`USER LEFT ${socket.id}`)
    let user = users.removeUser(socket.id);
    if (user) {
      if (user.room !== "") {
        io.to(user.room).emit('updateUsersList', users.getUserList(user.room));
        io.to(user.room).emit('newMessage', generateMessage('Admin', `${user.name} has left ${user.room} chat room.`))
      }
    }
  });
});

// server.listen(port, () => {
//   console.log(`Server is up on port ${port}`);
// })
