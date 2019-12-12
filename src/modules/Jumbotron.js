import React, { Component } from 'react';
import './Jumbotron.css'

export default class Jumbotron extends Component {
    render() {
        return (
            <section className="jumbotron">
                <h1>{this.props.item.agilityFields.title}</h1>
                <h2>{this.props.item.agilityFields.subTitle}</h2>
            </section>
        );
    }
}


