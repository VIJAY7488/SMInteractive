import express from 'express';



const app = express();

app.use(express.json());



app.get('/', (req, res) => res.send('Roxstar Spin Wheel Backend'));


export default app;