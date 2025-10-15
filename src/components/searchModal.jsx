import React, { useState } from 'react'
// TODO:
// Better Comments in Extension
const SearchModal = () => {

    const[showFilter,setShowFilter] = useState(false);

  return (
    <div className='search-main-Modal'>
        <div className="search-input-div">
            <input type="text" placeholder='Search what listing your looking for?'/>
            <button>
                <svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px" fill="#000000ff"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>
                </svg>
            </button>
        </div>

        <div className="advance-Seaching">
            <br />
            <button className="advance-Seaching-filterButton" 
            onClick={() => setShowFilter(!showFilter)}
            style={{
                background:`${showFilter ? "0":"red"}`,
                color:`${showFilter ? "black":"white"}`
            }}
            >{showFilter ? "Filter":"Close"}</button>
            <div className="advance-Seaching-category-group" 
            style={{
                visibility: `${showFilter ? "hidden":"visible"}`,

                opacity: `${showFilter ? "0":"1"}`,

            }}>
                <h2>Filter Search</h2>
                <select name="" id="">
                    <option value="">Type of Listing</option>
                </select>

                 <select name="" id="">
                    <option value="">Where</option>
                </select>

                <input type="text" name="" id="" placeholder='Name of Host'/>
            </div>
        </div>

        <div className="searched-items-found">

        </div>
    </div>
  )
}

export default SearchModal