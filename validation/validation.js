const { check, body } = require('express-validator');
const User = require('../models/user');

const validate = (method) => {
  switch (method) {
    // PRODUCT
    case 'addProduct': {
      return [
        body('title')
          .isString()
          .withMessage('Please enter a valid title')
          .isLength({ min: 3 })
          .withMessage('Title should be atleast 3 characters in length')
          .trim(),
        // body('imageUrl')
        //   .isURL()
        //   .withMessage('Please enter a valid image URL')
        //   .trim(),
        body('price').isCurrency().withMessage('Please enter a valid price'),
        body('description')
          .isLength({ min: 5, max: 400 })
          .withMessage('Description should be 5-400 characters in length')
          .trim(),
      ];
    }
    case 'editProduct': {
      return [
        body('title')
          .not()
          .isEmpty()
          .withMessage('Please enter a valid title')
          .isLength({ min: 3 })
          .withMessage('Title should be atleast 3 characters in length')
          .trim()
          .escape(),
        // body('imageUrl', 'Please enter a valid image URL')
        //   .not()
        //   .isEmpty()
        //   .withMessage()
        //   .isURL()
        //   .trim(),
        body('price')
          .escape()
          .isCurrency()
          .withMessage('Please enter a valid price')
          .trim(),
        body('description')
          .trim()
          .escape()
          .not()
          .isEmpty()
          .withMessage('Please enter a valid description')
          .isLength({ min: 5, max: 400 })
          .withMessage('Description should be 5-400 characters in length'),
      ];
    }
    // AUTH
    case 'postLogin': {
      return [
        check('email')
          .isEmail()
          .withMessage('Please enter a valid email')
          .custom((value, { req }) => {
            return User.findOne({ email: value }).then((user) => {
              if (!user) {
                return Promise.reject('Email doesnt exist');
              }
            });
          })
          .if(body('email').notEmpty())
          .trim()
          .normalizeEmail(),
      ];
    }
    case 'postSignUp': {
      return [
        check('email')
          .isEmail()
          .withMessage('Please enter a valid email')
          .custom((value, { req }) => {
            if (value === 'email@test.com') {
              throw new Error('Test email is not allowed');
            }

            return true;
          })
          .custom((value, { req }) => {
            return User.findOne({ email: value }).then((user) => {
              if (user) {
                return Promise.reject('Email already exists.');
              }
            });
          })
          .if(body('password').notEmpty())
          .trim()
          .normalizeEmail(),
        body(
          'password',
          'Password should be atleast 5 characters in length and should contain alphanumeric characters'
        )
          .isLength({ min: 5 })
          // .withMessage('Password should be atleast 5 characters in length')
          .isAlphanumeric()
          // .withMessage('Password should be only contains alphanumeric characters'),
          .trim(),
        body('confirmPassword')
          .custom((value, { req }) => {
            if (value !== req.body.password) {
              throw new Error('Password and Confirm Password do not match');
            }

            return true;
          })
          .if(body('confirmPassword').notEmpty())
          .trim(),
      ];
    }
  }
};

exports.validate = validate;
