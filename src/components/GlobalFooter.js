import React, { Component } from 'react';
import { graphql, StaticQuery } from "gatsby"

import './GlobalFooter.css'

export default props => (
	<StaticQuery
		query={graphql`
        query GlobalFooterQuery {
            agilityContent(properties: {referenceName: {eq: "globalfooter"}}) {
                agilityFields {
                footerText
                }
            }

          }
        `}
		render={queryData => {
			const viewModel = {
				item: queryData.agilityContent
			}
			return (
				<GlobalFooter {...viewModel} />
			);
		}}
	/>
)

class GlobalFooter extends Component {
	renderFooter = () => {

		if (this.props.item.agilityFields.footerText) {
			return <div dangerouslySetInnerHTML={{ __html: this.props.item.agilityFields.footerText }}></div>
		}
	}
	render() {

		return (
			<footer className="footer">
				<div className="container">
					{this.renderFooter()}
				</div>
			</footer>
		);
	}
}


