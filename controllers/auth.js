const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { validationResult } = require('express-validator');

const getErrorMessage = (req) => {
  let errorMessage = req.flash('errorMessage');
  if (errorMessage.length > 0) {
    errorMessage = errorMessage[0];
  } else {
    errorMessage = null;
  }

  return errorMessage;
};

const handleLoginError = ({
  res,
  oldInput = {},
  errors,
  errorMsg = '',
  isCustomError = false,
}) => {
  const errorMessage = isCustomError ? errorMsg : errors.array()[0].msg;
  const validationErrors = isCustomError
    ? oldInput
    : errors
        .array()
        .map((error) => error.param)
        .reduce((a, v) => ({ ...a, [v]: v }), {});

  return res.status(422).render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    errorMessage,
    validationErrors,
    oldInput,
  });
};

exports.getLogin = (req, res, next) => {
  const errorMessage = getErrorMessage(req);

  res.render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    errorMessage,
    validationErrors: {},
    oldInput: {
      email: '',
      password: '',
    },
  });
};

exports.getSignup = (req, res, next) => {
  const errorMessage = getErrorMessage(req);

  res.render('auth/signup', {
    path: '/signup',
    pageTitle: 'Signup',
    errorMessage,
    validationErrors: {},
    oldInput: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });
};

exports.postLogin = (req, res, next) => {
  const { email, password } = req.body;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    handleLoginError({ res, oldInput: { email, password }, errors });
    return;
  }

  User.findOne({ email })
    .then((user) => {
      // validate password
      bcrypt
        .compare(password, user.password)
        .then((isMatched) => {
          if (isMatched) {
            // save session info
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save((err) => {
              res.redirect('/');
            });
          }

          const errorMessage = 'Invalid email or password.';
          req.flash('errorMessage', errorMessage);
          return req.session.save((err) => {
            handleLoginError({
              res,
              oldInput: { email, password },
              errors: [],
              errorMsg: errorMessage,
              isCustomError: true,
            });
          });
        })
        .catch((err) => {
          console.log(err);
          res.redirect('/login');
        });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postSignup = (req, res, next) => {
  const { email, password, confirmPassword } = req.body;

  // add validation here
  const errors = validationResult(req);
  const validationErrors = errors
    .array()
    .map((error) => error.param)
    .reduce((a, v) => ({ ...a, [v]: v }), {});

  if (!errors.isEmpty()) {
    return res.status(422).render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      errorMessage: errors.array()[0].msg,
      validationErrors,
      oldInput: {
        email,
        password,
        confirmPassword,
      },
    });
  }

  // User.findOne({ email })
  //   .then((user) => {
  //     // if user email already exist, redirect to signup page
  //     if (user) {
  //       req.flash('errorMessage', 'Email already exists.');
  //       return req.session.save((error) => {
  //         res.redirect('/signup');
  //       });
  //     }
  //   })

  // encrypt password
  bcrypt
    .hash(password, 12)
    .then((encryptedPassword) => {
      // create new user
      const user = new User({
        email,
        password: encryptedPassword,
        cart: { items: [] },
      });

      return user.save();
    })
    .then(async (result) => {
      res.redirect('/login');
      // return await sendEmailWithEtherialService();
      return await sendEmailWithGmailService();
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    console.log(err);
    res.redirect('/');
  });
};

exports.getReset = (req, res, next) => {
  const errorMessage = getErrorMessage(req);

  res.render('auth/reset', {
    path: '/reset',
    pageTitle: 'Reset Password',
    errorMessage,
  });
};

exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect('/reset');
    }
    const token = buffer.toString('hex');

    User.findOne({ email: req.body.email })
      .then((user) => {
        if (!user) {
          req.flash('errorMessage', 'No account with that email found.');

          return req.session.save((err) => {
            res.redirect('/reset');
          });
        }

        // save reset token data to user
        const ONE_HOUR_IN_MS = 3600000;
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + ONE_HOUR_IN_MS;
        return user.save();
      })
      .then(async (result) => {
        if (result) {
          res.redirect('/');

          // send reset password email
          await sendResetPasswordEmail(req.body.email, token);
        }
      })
      .catch((err) => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  });
};

const sendResetPasswordEmail = async (email, token) => {
  let testAccount = await nodemailer.createTestAccount();

  let transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  let info = await transporter.sendMail({
    from: '"Mike Cutie 👻" <mike@cutie.com>',
    to: email,
    subject: 'Password Reset',
    text: 'Password Reset!',
    html: `
      <p>You requested a password reset</p>
      <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password</p>
    `,
  });

  console.log('Message sent: %s', info.messageId);

  // Preview only available when sending through an Ethereal account
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
};

exports.getNewPassword = (req, res, next) => {
  const { token } = req.params;

  User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      const errorMessage = getErrorMessage(req);

      res.render('auth/new-password', {
        path: '/new-password',
        pageTitle: 'New Password',
        errorMessage,
        userId: user._id.toString(),
        passwordToken: token,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postNewPassword = (req, res, next) => {
  const { password: newPassword, userId, passwordToken } = req.body;
  let resetUser;

  User.findOne({
    _id: userId,
    resetToken: passwordToken,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      resetUser = user;
      // encrypt password
      return bcrypt.hash(newPassword, 12);
    })
    .then((encryptedPassword) => {
      console.log('resetUser::', resetUser);
      // update user password and token data
      resetUser.password = encryptedPassword;
      resetUser.resetToken = null;
      resetUser.resetTokenExpiration = null;

      return resetUser.save();
    })
    .then((result) => res.redirect('/login'))
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

const sendEmailWithEtherialService = async () => {
  // Generate test SMTP service account from ethereal.email
  // Only needed if you don't have a real mail account for testing
  let testAccount = await nodemailer.createTestAccount();

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: testAccount.user, // generated ethereal user
      pass: testAccount.pass, // generated ethereal password
    },
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: '"Mike Cutie 👻" <mike@cutie.com>', // sender address
    to: 'bojecof901@dicopto.com', // list of receivers
    subject: 'Hello there! ✔', // Subject line
    text: 'Hello world?', // plain text body
    html: '<b>Hello world?</b>', // html body
  });

  console.log('Message sent: %s', info.messageId);
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

  // Preview only available when sending through an Ethereal account
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...

  return info;
};

const sendEmailWithGmailService = async () => {
  let testAccount = await nodemailer.createTestAccount();
  console.log(testAccount);

  let mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'email@gmail.com',
      // pass value should come from app password from your google account > security
      pass: 'oslideheuvemjiym',
    },
  });

  let mailDetails = {
    from: 'email@gmail.com',
    to: 'test.email@gmail.com',
    subject: 'Test mail',
    text: 'Node.js test mail',
    html: '<h1>Hello world!</h1>',
  };

  return mailTransporter.sendMail(mailDetails, function (err, data) {
    if (err) {
      console.log('Error Occurs', err);
    }

    if (data) {
      console.log('Email sent successfully');
      console.log(data);
    }
  });
};
