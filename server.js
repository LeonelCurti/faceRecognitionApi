const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const app = express();
const knex = require('knex')
const Clarifai = require('clarifai');

const db = knex({
  client: 'pg',
  connection: {
    host : '127.0.0.1',
    user : 'postgres',
    password : 'hola1234',
    database : 'smartbrain'
  }
});

const clarifaiapp = new Clarifai.App({
  apiKey: '914d8d94ddb643ef948a9e12bf19cf7e'
 });

app.use(bodyParser.json());
app.use(cors());

app.get('/', (req, res)=>{
  res.json('nothing to see');
})

app.post('/signin', (req, res)=>{
  const {email, password} = req.body;
  if(!email || !password){
    return res.status(400).json('incorrect form submission');
  }
  db.select('email','hash').from('login')
  .where('email','=',email)
  .then(data =>{
    const isValid = bcrypt.compareSync(password,data[0].hash);
    if (isValid) {
      return db.select('*').from('users')
        .where('email','=',email)
        .then(user => res.json(user[0]))
        .catch(()=>res.status(400).json('unable to get user: wrong credentials'))
    }else{
      res.status(400).json('unable to get user: wrong credentials');
    }
  })
  .catch(()=>res.status(400).json('unable to get user'))
})

app.post('/register', (req, res)=>{
  const {email, name, password} = req.body;
  if(!email || !name || !password){
    return res.status(400).json('incorrect form submission');
  }
  const hash = bcrypt.hashSync(password);

  db.transaction(trx =>{
    trx.insert({
      hash: hash,
      email: email
    })
    .into('login')
    .returning('email')
    .then(loginEmail =>{
      return trx('users')
      .returning('*')
      .insert({
        email: loginEmail[0],
        name: name,
        joined: new Date()        
      })
      .then(user => res.json(user[0]))
    })
    .then(trx.commit)
    .catch(trx.rollback) 
  }) 
  .catch(() => res.status(400).json('db: unable to register'))
})

app.get('/profile/:id', (req, res)=>{
  const { id } = req.params;
  db.select('*').from('users').where({
    id: id
  })
  .then(resp =>{
    if(resp.length){
      res.json(resp[0])
    }else{
      res.status(400).json('Not found')
    }
  })
  .catch(() => res.status(400).json('error getting user'))
})

app.post('/image', (req, res)=>{
  const { id } = req.body;
  db('users')
  .where('id','=',id)
  .increment('entries',1)
  .returning('entries')
  .then( entries => res.json(entries[0]) )
  .catch(() => res.status(400).json('unable to get entries'))
})

app.post('/imageclarifai',(req, res)=>{
  clarifaiapp.models.predict(Clarifai.FACE_DETECT_MODEL, req.body.input)
  .then(data =>{
    res.json(data);
  })
  .catch(err => res.status(400).json('unable to work with api'))
})

app.listen(process.env.PORT || 3010, () => {
  console.log(`app is running on port ${process.env.PORT}`);
  
});