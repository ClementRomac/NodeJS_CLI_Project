#!/usr/bin/env node
const api = require('marvel-api');
const program = require('commander');
const Promise = require('promise')
const inquirer = require('inquirer')
const db = require('sqlite')
const fs = require('fs')
const async = require('async')
 
const marvel = api.createClient({
  publicKey: 'e0fed23cedb2f37c8bc25a3ee2edad77'
, privateKey: '2b9503a501df25792d5455e0687b81bed3bcf1c8'
});

program
	.version('1.0.0')
	.option('-l, --list', 'List all marvel heros')
	.option('-i, --infos [hero]', 'List caracteristics of a hero')
	.option('-f, --favorites', 'Access to your favorites heros')

program.parse(process.argv)

if(program.list){
	var heros = [1, 101, 202, 303, 404, 505, 606, 707, 808, 909, 1010, 1111, 1212, 1313 ,1414] // boucle sur les 1485 heros
	var asyncTasks = []
	var list_heros = []

	// FindAll retourne au max 100 objets donc obligation de boucler pour avoir les 1485
	heros.forEach(function (j) { 
	    asyncTasks.push(function (callback) { // Pour chaque index dans le tableau heros et ajoute au tableau asyncTask une fonction qui contient l'appel de l'api marvel
	        marvel.characters.findAll(100, j).then((result) => {
	        	for(z=0;z<result.meta.count;z++){
	        		list_heros.push(result.data[z].name)
	        	}

	        	callback()
	        })
	    });
	});

	console.log("Voici la liste des heros :")
	async.parallel(asyncTasks, function () {
	    console.log(list_heros.sort()) // On tri la liste parce que les résultats ont été renvoyé dans l'ordre de réponse des promises et donc les résultats sont mélangés
	});
}
else if(program.infos){
	GetCharacterInfos(program.infos).then((result) => {
		console.log(`Fiche de ${program.infos} :`)
		console.log(result)
	}).catch((err) => {
		console.log('Ce personnage n\'existe pas')
	})
}
else if(program.favorites){
	console.log("Bienvenue dans vos favoris ! \n")
	inquirer.prompt([
	{
		type: 'list',
		message: 'Que voulez-vous faire ?',
		name: 'task',
		choices: [
			'Lister mes favoris',
			'Ajouter un favoris',
			'Supprimer un favoris',
			'Voir les caractéristiques d\'un de mes favoris'
		]
	}
	])
	.then((answer) => {
		db.open('./database.sqlite').then(() => {
			return db.run("CREATE TABLE IF NOT EXISTS favorites (name)") // Ouverture + création de la table si elle n'exite pas
		})
		.then(() => {
			switch(answer.task){
				case 'Lister mes favoris': // Liste le nom des favoris sauvgardés dans la bdd
					db.all("SELECT name FROM favorites").then((data) => {
						console.log("Vos favoris : \n")
						for(i=0; i<data.length; i++){
							console.log(data[i].name + "\n")
						}
					})
					break
				case 'Ajouter un favoris': // Ajoute le nom du favoris dans la bdd + ajoute ses caractéristiques dans un fichier
					var characterName
					inquirer.prompt([
					{
						type:'input',
						message: 'Quel est le nom de votre héros ?',
						name: 'name'
					}
					]).then((answer) => {
						characterName = answer.name
						return GetCharacterInfos(answer.name)
					}).then((infos) => {
						db.run("INSERT INTO favorites(name) VALUES (?)", characterName)
						fs.writeFile(characterName+'.csv', infos, (err) =>{
							if(err) throw err
						})
					}).then(()=>{
						console.log(`Favoris ${characterName} sauvegardé ! `)
					}).catch((err) => {
						console.log('Ce personnage n\'exsite pas')
					})
					break
				case 'Supprimer un favoris':
					var characterName
					inquirer.prompt([
					{
						type:'input',
						message: 'Quel est le nom du favoris que vous voulez supprimer ?',
						name: 'name'
					}
					]).then((answer) => {
						db.run("DELETE FROM favorites WHERE name = ?", answer.name)
						fs.unlink(answer.name+'.csv', (err) =>{
							if(err) throw err
						})
					}).then(()=>{
						console.log(`Favoris supprimé ! `)
					}).catch((err) => {
						console.log('Ce personnage n\'est pas dans vos favoris')
					})
					break
				case 'Voir les caractéristiques d\'un de mes favoris': // Récupère les caractéristiques d'un favoris sauvegardé dans un fichier
					inquirer.prompt([
					{
						type:'input',
						message: 'Quel est le nom de votre favoris ?',
						name: 'name'
					}
					]).then((answer) => {
						fs.readFile(answer.name+'.csv', 'utf8', (err, data) =>{
							if(err) throw err
							console.log('Voici les infos de votre favoris ' + answer.name + '\n')
							console.log(data)
						})
					}).catch((err) => {
						console.log('Ce personnage n\'est pas dans vos favoris')
					})
					break
			}
		})
	})
}
else{
	program.help()
}

function GetCharacterInfos(name){ // Extrait les charactéristiques d'un héros
	return new Promise((then, error)=>{
		var characterInfos = ""
		var characterId
		marvel.characters.findByName(name)
		.then((result) => {
	  		characterInfos += `Descrition : ${result.data[0].description} \n`
	  		characterInfos += `Id : ${result.data[0].id} \n`
	  		characterInfos += `Date de modification : ${result.data[0].modified} \n`
	  		
	  		characterId = result.data[0].id
	  		
	  		return marvel.characters.comics(characterId)	  		
		})
		.then((result) => {
			characterInfos += ListInfos(result, "comics")

			return marvel.characters.series(characterId)
		})
		.then((result) => {
			characterInfos += ListInfos(result, "series")
			
			return marvel.characters.stories(characterId)
		})
		.then((result) => {
			characterInfos += ListInfos(result, "stories")

			then(characterInfos)
		})
		.fail((err)=>{
			error(err)
		});
	})
}

function ListInfos(object, type){ // Met en forme des infos d'un heros
	infos = ""
	infos += `Présent dans ${object.meta.count} ${type}`
	if(object.meta.count > 0 ){
		infos += " : \n"
		for(i=0; i<object.meta.count; i++){
			infos += `- ${object.data[i].title} \n`
		}
	} 

	return infos
}


