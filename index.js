// Project-JS
// ROHAN M
// Srikanth Chava

const express = require('express');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const session = require('express-session'); // Add this line
const path = require('path');
const myApp = express();

//importing the mongoose module
const mongoose = require('mongoose');

myApp.use(express.static(path.join(__dirname, 'public')));

// Parse incoming requests with JSON payloads
myApp.use(bodyParser.json());

//using file upload function

myApp.use(fileUpload());

//login obj for display error msgs
let loginError = {};

mongoose.connect('mongodb://127.0.0.1:27017/ContentManagementSystem');
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB database');
});

myApp.use(
  session({
    secret: 'rm889247',
    resave: true,
    saveUninitialized: false,
  }),
);

//schema for user details
const userSchema = mongoose.Schema({
  username: String,
  password: String,
});

//schema for pageDetails
const pageSchema = new mongoose.Schema({
  title: String,
  content: String,
  imagePath: String, // Store the image path
});

const UserModel = mongoose.model('auth', userSchema);
const PageModel = mongoose.model('Page', pageSchema);

myApp.use(express.urlencoded({ extended: false }));
myApp.use(express.json());
// set the views folder (where will the application find the view)
myApp.set('views', path.join(__dirname, 'views'));
// directing react to our static components: client-side Javascript, CSS, images, ...
myApp.use(express.static(path.join(__dirname, 'public')));
// let the express app know which engine are we using for the view
myApp.set('view engine', 'ejs');

myApp.use('/edit-page/css', express.static(path.join(__dirname, 'public/css')));
myApp.use(
  '/delete-page/css',
  express.static(path.join(__dirname, 'public/css')),
);
myApp.use(
  '/update-page/css',
  express.static(path.join(__dirname, 'public/css')),
);
myApp.use('/page/css', express.static(path.join(__dirname, 'public/css')));

// Fetch the list of pages
myApp.use(async (req, res, next) => {
  try {
    const pages = await PageModel.find({}, 'title');
    res.locals.pages = pages;
    next();
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.locals.pages = []; // Default to empty array if an error occurs
    next();
  }
});

//default rendering get method
myApp.get('/', (req, res) => {
  res.render('about');
});

//home api route
myApp.get('/home', (req, res) => {
  res.render('home', { loginError });
});

//login route
myApp.post('/login', (req, res) => {
  UserModel.findOne({ username: req.body.username }).then((user) => {
    console.log(user);
    if (
      user === null ||
      user.username != req.body.username ||
      user.password != req.body.password
    ) {
      loginError = {
        msg: 'invalidCredentials',
      };
      res.render('home', { loginError });
    } else {
      req.session.user = user;
      res.render('welcomeAdmin', { user });
    }
  });
});

myApp.get('/addPage', (req, res) => {
  res.render('addPage');
});

myApp.post('/save-page', (req, res) => {
  console.log('request body is', req.body);
  const { title, content } = req.body;
  const image = req.files.image;
  const imagePath = `images/${image.name}`; // Store the image path

  // Save the image to the public/images folder
  const imageSavePath = path.join(__dirname, 'public', imagePath);
  image.mv(imageSavePath, (err) => {
    if (err) {
      console.error('Error saving image:', err);
      return res.status(500).send('Error saving image.');
    }

    // Create a new Page model instance and save it to the database
    const newPage = new PageModel({
      title,
      content,
      imagePath, // Save the image path
    });

    newPage.save();
    // Page saved successfully
    console.log('page saved successfully');
    const responseObj = {
      msg: 'Add New Page',
      status: 'You have successfully created a new page',
    };
    res.render('adminResponse', { responseObj });
  });
});

//display the page list
myApp.get('/page-list', async (req, res) => {
  try {
    const pages = await PageModel.find();
    console.log('list of pages', pages);
    res.render('pageList', { pages });
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).send('Internal Server Error');
  }
});

//Render the page with existing content for editing
myApp.get('/edit-page/:id', async (req, res) => {
  try {
    const page = await PageModel.findById(req.params.id);
    res.render('editPage', { page });
  } catch (error) {
    console.error('Error fetching page for editing:', error);
    res.status(500).send('Internal Server Error');
  }
});

//  update the content and update it in the database
myApp.post('/update-page/:id', async (req, res) => {
  const pageId = req.params.id;
  const { title, content } = req.body;
  const newImage = req.files.newImage;

  try {
    // Find the existing page by its ID
    const existingPage = await PageModel.findById(pageId);

    // Remove the old image if it exist
    if (existingPage.imagePath) {
      const imagePathToDelete = path.join(
        __dirname,
        'public',
        existingPage.imagePath,
      );
      fs.unlinkSync(imagePathToDelete);
    }

    // Save the new image to the public/images folder
    const newImagePath = `images/${newImage.name}`;
    const newImageSavePath = path.join(__dirname, 'public', newImagePath);
    newImage.mv(newImageSavePath);

    // Update the page details including the new image path
    existingPage.title = title;
    existingPage.content = content;
    existingPage.imagePath = newImagePath;
    await existingPage.save();

    // Page updated successfully
    console.log('Page updated successfully');
    const responseObj = {
      msg: 'Edit Page',
      status: 'You have successfully edited the page',
    };
    res.render('adminResponse', { responseObj });
  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Delete the page from the database
myApp.get('/delete-page/:id', async (req, res) => {
  try {
    const pageId = req.params.id;
    // Find the page by ID to get the image path
    const page = await PageModel.findById(pageId);
    if (!page) {
      return res.status(404).send('Page not found');
    }

    // Delete the image file from the images folder
    const imagePath = path.join(__dirname, 'public', page.imagePath);
    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error('Error deleting image:', err);
      } else {
        console.log('Image deleted successfully:', page.imagePath);
      }
    });

    // Delete the page record from the database
    await PageModel.findByIdAndDelete(pageId);

    console.log('Page deleted successfully');
    const responseObj = {
      msg: 'Delete Page',
      status: 'You have successfully Deleted the page',
    };
    res.render('adminResponse', { responseObj });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).send('Internal Server Error');
  }
});

//route for displaying pages
myApp.get('/page/:id', async (req, res) => {
  try {
    const page = await PageModel.findById(req.params.id);
    if (!page) {
      return res.status(404).send('Page not found');
    }
    console.log('page data', page);
    res.render('page', { page });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Logout route
myApp.get('/logout', (req, res) => {
  // Clear user session on logout
  req.session.destroy();
  res.redirect('/home');
});

myApp.listen(8080);
console.log('application started');
