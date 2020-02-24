import React, { Component } from 'react';

import './PostDetails.css'

class PostDetails extends Component {

	renderPostContent(html) {
		return { __html: html };
	}

	render() {

		const post = this.props.dynamicPageItem;
		return (
			<section className="post-details">
				<div className="container">
					<div className="post">
						<h1>{post.customFields.title}</h1>
						{post.customFields.image &&
							<img src={post.customFields.image.url + '?w=860'} alt="" />
						}

						<div><span className="author">{post.customFields.author.customFields.name}</span> | {post.customFields.category.customFields.title}</div>
						<hr />
						<div className="post-content" dangerouslySetInnerHTML={this.renderPostContent(post.customFields.details)}></div>
					</div>
				</div>
			</section>
		);
	}
}

export default PostDetails;
