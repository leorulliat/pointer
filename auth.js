
const TOKEN = process.env.TOKEN;

module.exports = (req, res, next) => {
    if(req.headers.token != TOKEN){
		res.status(401).send("Unauthorized")
	}
    next()
};