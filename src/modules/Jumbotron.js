import React, { Component } from 'react';
import './Jumbotron.css'

export default class Jumbotron extends Component {
	render() {

		let jumboTronStyle = {
			x: 1
		};

		if (this.props.item.agilityFields.backgroundImage) {
			jumboTronStyle.backgroundImage = "url('" + this.props.item.agilityFields.backgroundImage.url + "?w=1000')";
		}

		return (
			<section className="jumbotron" style={jumboTronStyle}>
				<h1>{this.props.item.agilityFields.title}</h1>
				<h2>{this.props.item.agilityFields.subTitle}</h2>
			</section>
		);
	}
}


