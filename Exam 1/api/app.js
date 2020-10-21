const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const { User } = require('./db.js');
const { Op } = require('sequelize');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const cors = require('cors')
const {sendEmail, isAuthenticated} = require('./utils')

//-----------------------------------------------
//            LOCAL STRATEGY                    |
//-----------------------------------------------
passport.use(
    new LocalStrategy(
        {
            usernameField: "email",
            passwordField: "password",
            passReqToCallback: true,
        },
        (req, email, password, done) => {
            User.findOne({ where: { email } }).then((user) => {
                if (!user) {
                    return done(null, false, { message: `User ${email} not found` });
                } else if (password != user.password) {
                    return done(null, false, { message: "Password incorrect" });
                } else return done(null, user.dataValues);
            });
        }
    )
);

//-------------------------------------
//        SERIALIZE USER              |
//-------------------------------------
passport.serializeUser((user, done) => {
    return done(null, user.id);
});

//-------------------------------------
//        DESERIALIZE USER            |
//-------------------------------------
passport.deserializeUser((id, done) => {
    User.findByPk(id)
        .then((user) => {
            return done(null, user.get());
        })
        .catch((err) => done(err, false));
});

const server = express();

server.name = 'API';
server.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
server.use(bodyParser.json({ limit: '50mb' }));
server.use(cors());
server.use(morgan('dev'));
server.use(cookieParser());
server.use(
    require('express-session')({
        secret: 'secret',
        resave: false,
        saveUninitialized: false,
    }),
);
server.use(passport.initialize());
server.use(passport.session());


//\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
//\\\\             ROUTES               \\\\\
//\\\\                                  \\\\\
//\\\\----------------------------------\\\\\
//\\\\              GET                 \\\\\
//\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

server.get('/', (req, res) => {
    User.findAll()
        .then(us => res.send(us))
        .catch(err => res.send(err))
})

server.get('/user/:id', isAuthenticated, (req, res) => {
    User.findOne({
        where: {
            id: req.params.id
        }
    })
        .then(us => res.send(us))
        .catch(err => res.send(err))
})

server.get('/search', isAuthenticated, (req, res) => {
    const contact = req.query.user
    User.findOne({
        where: {
            [Op.or]: [{ first_name: { [Op.like]: `%${contact}%` } }]
        }
    })
        .then(user => res.send(user).status(200))
        .catch(err => res.send(err))
})


//\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
//\\\\              POST                \\\\\
//\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\


server.post('/', (req, res) => {
    User.findOne({
        where: {
            email: req.body.email
    }})
    .then(user => !user ? User.create(req.body).then(us => res.send(us).status(201))
    .catch(err => res.send(err).status(401)) : res.send('User already exists'))
})


// Add friend

server.post('/add/:id', isAuthenticated, (req, res) => {
    const { email } = req.body;
    let user1 = User.findOne({
        where: {
            id: req.params.id
        }
    })
    let user2 = User.findOne({
        where: {
            email: email
        }
    })
    Promise.all([user1, user2])
        .then(user => {
            let us1 = user[0]
            let us2 = user[1]
            us1.addContact(us2)
            sendEmail('You are in my contact list', `We added you in our contact list. Thank you. I'm ${us1.first_name} ${us1.last_name}`, email)
            res.send(us2)
        })
        .catch(err => res.send(err).status(401))
})

//\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
//\\\\              PUT                 \\\\\
//\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

server.put('/updateUser/:id', isAuthenticated, (req, res) => {
    const { firstName, lastName, email, contactNumber, password } = req.body
    User.findOne({
        where: {
            id: req.params.id
        }
    })
        .then(user => {
            user.update({
                first_name: firstName,
                last_name: lastName,
                email: email,
                contact_number: contactNumber,
                password: password
            })
            res.send(user).status(202)
        })
        .catch(err => res.send(err).status(401))
})


//\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
//\\\\             DELETE               \\\\\
//\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

server.delete('/:id', (req, res) => {
    User.findOne({
        where: {
            id: req.params.id
        }
    })
        .then(user => {
            user.destroy()
            res.send('Done').status(200)
        })
        .catch(err => res.send(err).status(401))
})

//remove friend
server.delete('/remove/:id', isAuthenticated, (req, res) => {
    const { email } = req.body;
    let user1 = User.findOne({
        where: {
            id: req.params.id
        }
    })
    let user2 = User.findOne({
        where: {
            email: email
        }
    })
    Promise.all([user1, user2])
        .then(user => {
            let us1 = user[0]
            let us2 = user[1]
            us1.removeContact(us2)
            res.send(us2)
        })
        .catch(err => res.send(err).status(401))
})

//-------------------------------------
//            LOGIN                   |
//-------------------------------------

server.post('/login', passport.authenticate('local'), function (req, res,) {
    res.send(req.user)
});

//-------------------------------------
//            LOGOUT                   |
//-------------------------------------

server.post('/logout', (req, res) => {
    req.logout()
    req.session.destroy()
    res.send('Successful logout')
});

module.exports = server;