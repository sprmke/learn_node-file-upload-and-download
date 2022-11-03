// Libraries
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');

// Routes
const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

// Controllers
const errorController = require('./controllers/error');

// Models
const User = require('./models/user');

dotenv.config();

const app = express();
const store = new MongoDBStore({
  uri: process.env.MONGODB_CONNECTION_STRING,
  collection: 'sessions',
});

const csrfProtection = csrf();

app.set('view engine', 'ejs');
app.set('views', 'views');

app.use(bodyParser.urlencoded({ extended: false }));

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const error = null;
    cb(error, 'images');
  },
  filename: (req, { originalname }, cb) => {
    const error = null;
    cb(error, `${new Date().toISOString()}-${originalname}`);
  },
});

const fileFilter = (req, { mimetype }, cb) => {
  // only accept png & jpg image files
  if (['image/png', 'image/jpg', 'image/jpeg'].includes(mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// handle file data from request
// save file to images directory
app.use(
  multer({ dest: 'images', storage: fileStorage, fileFilter }).single('image')
);

// handle static routes
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// initialize session
app.use(
  session({
    secret: 'my secret',
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use((req, res, next) => {
  // Throwing new error on sync task
  // will be handled on our error handling middleware
  // throw new Error('Sync Error');

  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then((user) => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch((err) => {
      console.log(err);
      // throw new Error will not work for async task
      // throw new Error(err);

      // the Error should be passed inside next()
      // for our error handling middleware to handle it
      next(new Error(err));
    });
});
app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.use('/500', errorController.get500);
app.use(errorController.get404);

// express error handling middleware
app.use((error, req, res, next) => {
  // res.redirect('/500');
  if (error) {
    console.error('error::', error);
    res.status(500).render('500', {
      pageTitle: 'Error!',
      path: '/500',
      isAuthenticated: req.session.isLoggedIn,
    });
  }
});

mongoose
  .connect(process.env.MONGODB_CONNECTION_STRING)
  .then((result) => {
    app.listen(3000);
  })
  .catch((err) => {
    console.log(err);
  });
