import React, { Component } from 'react';

import './PostDetails.css'

class PostDetails extends Component {

    renderPostContent(html) {
        return { __html: html };
    }

    render() {
        console.log("props module", this.props)
        const post = this.props.dynamicPageItem;
        return (
            <section className="post-details">
                <div className="container">
                    <div className="post">
                        <h1>{post.agilityFields.title}</h1>
                        {post.agilityFields.image &&
                            <img src={post.agilityFields.image.url + '?w=860'} alt="" />
                        }
                        <div className="post-content" dangerouslySetInnerHTML={this.renderPostContent(post.agilityFields.details)}></div>
                    </div>
                </div>
            </section>
        );
    }
}

export default PostDetails;
