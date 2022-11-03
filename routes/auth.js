const express = require('express');

const authController = require('../controllers/auth');
const { validate } = require('../validation/validation');

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

router.post('/login', validate('postLogin'), authController.postLogin);

router.post('/signup', validate('postSignUp'), authController.postSignup);

router.post('/logout', authController.postLogout);

router.get('/reset', authController.getReset);

router.post('/reset', authController.postReset);

router.get('/reset/:token', authController.getNewPassword);

router.post('/new-password', authController.postNewPassword);

module.exports = router;
