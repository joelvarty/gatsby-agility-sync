import React, { Component } from 'react';
import { Link, graphql, StaticQuery } from "gatsby"

import './GlobalHeader.css'

export default props => (
    <StaticQuery
        query={graphql`
        query GlobalHeaderQuery {
            agilityContent(properties: {referenceName: {eq: "globalheader"}}) {
                myFields {
                siteName
                }
            }

          }
        `}
        render={queryData => {
            const viewModel = {
                item: queryData.agilityContent,
                // menuLinks: queryData.allAgilitySitemapNode.nodes.filter(sitemapNode => {
                //     //only return top level links
                //     return sitemapNode.path.split('/').length == 2
                // })
            }
            return (
                <GlobalHeader {...viewModel} />
            );
        }}
    />
)

class GlobalHeader extends Component {
    renderLinks = () => {

        let links = [];
        this.props.menuLinks.forEach(node => {
            links.push(<li key={node.pageID}><Link to={node.path}>{node.menuText}</Link></li>)
        })
        return links;
    }
    render() {

        return (
            <header className="header">
                <div className="container">
                    <label>{this.props.item.myFields.siteName}</label>
                    <ul>
                        {/* {this.renderLinks()} */}
                    </ul>
                </div>
            </header>
        );
    }
}


