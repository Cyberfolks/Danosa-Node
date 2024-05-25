

const express = require('express');
const ngrok = require('ngrok');
const socketIO = require('socket.io');

const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';

var clients = {};
var connected_users = [];
const urlMain = null;


const app = express()
// .listen(PORT, () => console.log(`Listening on ${PORT}`))
// app.use((req, res) => res.sendFile(INDEX, { root: __dirname }))
const server = app.listen(PORT, () => {
  console.log('server running on port 3001',);
});



// ngrok.connect(PORT).then((url) => {
//   console.log(`${url}`);
//   urlMain = url
// });


const io = socketIO(server);

// io.on('connection', (socket) => {
//   console.log('Client connected');
//   socket.on('disconnect', () => console.log('Client disconnected'));
// });


const getVisitors = () => {
  let clients = io.sockets.clients().connected;
  let sockets = Object.values(clients);
  let users = sockets.map(s => s.user);
  return users;
};

const emitVisitors = () => {
  io.emit("visitors", getVisitors());
};

io.on('connection', (socket) => {


  socket.on('addUser', (data) => {
    console.log('addUser', data);
    clients[data.userId] = {
      "id": data.id,
      "socket": socket.id,
      "status": data.status,
      "isOnline": data.isOnline,
    };
    connected_users.push({
      "id": data.id,
      "socket": socket.id,
      "status": data.status,
      "isOnline": data.isOnline,
    });
    emitVisitors();
    io.sockets.emit('connected-users', { users_connected: connected_users });
    io.sockets.emit('clients', { clients: clients });
    // io.sockets.emit('connected-users', { users_connected: connected_users });
    console.log('clients', clients);
  });

  socket.on('updateUser', (data) => {
    console.log('updateUser', data);
    if (clients[data.userId]) {
      clients[data.userId] = {
        "id": data.id,
        "socket": clients[data.userId].socket,
        "status": data.status,
        "isOnline": data.isOnline,
      };
      connected_users.splice(connected_users.findIndex(function (i) {
        return i.id === data.userId;
      }), 1)
      connected_users.push({
        "id": data.id,
        "socket": socket.id,
        "status": data.status,
        "isOnline": data.isOnline,
      });
      io.sockets.emit('connected-users', { users_connected: connected_users });
      io.sockets.emit('clients', { clients: clients });
      // io.sockets.connected[clients[data.user].socket].emit("chat", data);
    } else {
      console.log("User does not exist: " + data.userId);
    }
  });

  socket.on('chat', (data) => {
    console.log('chat-message called', data);
    if (clients[data.user]) {
      io.sockets.connected[clients[data.user].socket].emit("chat", data);
    } else {
      console.log("User does not exist: " + data.user);
    }
  });

  socket.emit('connected-userx', { users_connected: connected_users });
  // io.sockets.clients(); 
  // Return All Users
  socket.on('available', (data) => {
    socket.emit('available', { users_connected: clients });
  });

  socket.on('online', (data) => {
    if (clients[data.user]) {
      io.sockets.connected[clients[data.user].socket].emit('online', data)
    }
  });

  socket.on('offline', () => {
    if (clients[data.user]) {
      io.sockets.connected[clients[data.user].socket].emit('offline')
    }
  });

  socket.on('busy', (data) => { //opp user
    if (clients[data.user]) {
      io.sockets.connected[clients[data.user].socket].emit('busy', data)
    }
  });

  socket.on('free', () => {
    if (clients[data.user]) {
      io.sockets.connected[clients[data.user].socket].emit('free')
    }
  })

  //Removing the socket on disconnect
  socket.on('removeUser', (data) => {
    console.log('removeUser', data)
    connected_users.splice(connected_users.findIndex(function (i) {
      return i.id === data.userId;
    }), 1)
    io.sockets.emit('connected-users', { users_connected: connected_users });
  })
  socket.on('disconnect', (data) => {
    console.log('disconnect', data)
    connected_users.splice(connected_users.findIndex(function (i) {
      return i === data.userId;
    }), 1)
    for (var name in clients) {
      if (clients[name].socket === socket.id) {
        delete clients[name];
        break;
      }
    }
    emitVisitors();
  })

});


// setInterval(() => io.emit('time', new Date().toTimeString()), 1000);
// setInterval(() => io.emit('ngrok', urlMain), 100000);


